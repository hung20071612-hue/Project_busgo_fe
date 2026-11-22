// Admin: Bến xe & Tuyến đường
// API: /admin/stations , /admin/routes  (cần token Admin)

const API_STATIONS = "/admin/stations";
const API_ROUTES = "/admin/routes";

let stationMap = {};

// ----- Tabs -----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ----- Modal xác nhận -----
let confirmCallback = null;

function openConfirm(title, message, onOk) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  confirmCallback = onOk;
  document.getElementById("confirm-modal").classList.add("show");
}

document.getElementById("confirm-cancel").onclick = () => {
  document.getElementById("confirm-modal").classList.remove("show");
  confirmCallback = null;
};

document.getElementById("confirm-ok").onclick = async () => {
  document.getElementById("confirm-modal").classList.remove("show");
  if (confirmCallback) await confirmCallback();
  confirmCallback = null;
};

// ----- Dropdown bến -----
async function refreshStationOptions() {
  try {
    const stations = await api.get(API_STATIONS);
    const list = Array.isArray(stations) ? stations : stations.items || [];
    stationMap = {};
    list.forEach((s) => {
      stationMap[s.id] = s;
    });

    const opts = list
      .filter((s) => s.is_active)
      .map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${s.id})</option>`)
      .join("");

    const dep = document.getElementById("route-departure");
    const arr = document.getElementById("route-arrival");
    const keepDep = dep.value;
    const keepArr = arr.value;
    dep.innerHTML = `<option value="">-- Chọn bến đi --</option>${opts}`;
    arr.innerHTML = `<option value="">-- Chọn bến đến --</option>${opts}`;
    if (keepDep) dep.value = keepDep;
    if (keepArr) arr.value = keepArr;
  } catch (e) {
    console.warn("Không tải được danh sách bến:", e.message);
  }
}

function stationName(id) {
  const s = stationMap[id];
  return s ? s.name : `#${id}`;
}

// ========== ROUTES ==========
const routeForm = document.getElementById("route-form");
const routeBody = document.getElementById("route-table-body");
const routeSearch = document.getElementById("route-search");
let editingRouteId = null;

async function loadRoutes() {
  routeBody.innerHTML = `<tr><td colspan="7" class="muted">Đang tải...</td></tr>`;
  try {
    const q = routeSearch.value.trim();
    const routes = await api.get(API_ROUTES, q ? { q } : undefined);
    renderRoutes(Array.isArray(routes) ? routes : routes.items || []);
  } catch (e) {
    routeBody.innerHTML = `<tr><td colspan="7" class="text-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderRoutes(routes) {
  if (!routes.length) {
    routeBody.innerHTML = `<tr><td colspan="7" class="muted">Chưa có tuyến</td></tr>`;
    return;
  }
  routeBody.innerHTML = routes
    .map(
      (r) => `
    <tr>
      <td><strong>${escapeHtml(r.code)}</strong></td>
      <td>${escapeHtml(stationName(r.departure_id))} → ${escapeHtml(stationName(r.arrival_id))}</td>
      <td>${r.distance_km}</td>
      <td>${r.estimated_time}</td>
      <td>${formatMoney(r.base_price)}</td>
      <td>
        <span class="badge ${r.is_active ? "badge-ok" : "badge-off"}">
          ${r.is_active ? "Hoạt động" : "Ngừng"}
        </span>
      </td>
      <td class="actions">
        <button class="btn btn-small" data-action="edit-route" data-id="${r.id}">Sửa</button>
        <button class="btn btn-small btn-danger" data-action="del-route" data-id="${r.id}">
          ${r.is_active ? "Ngừng" : "Xoá"}
        </button>
      </td>
    </tr>`
    )
    .join("");
}

routeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    code: routeForm.code.value.trim(),
    departure_id: Number(routeForm.departure_id.value),
    arrival_id: Number(routeForm.arrival_id.value),
    distance_km: Number(routeForm.distance_km.value),
    estimated_time: Number(routeForm.estimated_time.value),
    base_price: Number(routeForm.base_price.value || 0),
    is_active: true,
  };
  try {
    if (editingRouteId == null) {
      await api.post(API_ROUTES, data);
      showToast("Đã thêm tuyến");
    } else {
      await api.put(`${API_ROUTES}/${editingRouteId}`, data);
      showToast("Đã cập nhật tuyến");
    }
    resetRouteForm();
    loadRoutes();
  } catch (err) {
    showToast(err.message, "error");
  }
});

async function startEditRoute(id) {
  try {
    const r = await api.get(`${API_ROUTES}/${id}`);
    editingRouteId = id;
    routeForm.code.value = r.code;
    routeForm.departure_id.value = r.departure_id;
    routeForm.arrival_id.value = r.arrival_id;
    routeForm.distance_km.value = r.distance_km;
    routeForm.estimated_time.value = r.estimated_time;
    routeForm.base_price.value = r.base_price;
    document.getElementById("route-form-title").textContent = `Sửa tuyến #${id}`;
    document.getElementById("route-submit").textContent = "Lưu";
    document.getElementById("route-cancel").hidden = false;
  } catch (e) {
    showToast(e.message, "error");
  }
}

function resetRouteForm() {
  editingRouteId = null;
  routeForm.reset();
  document.getElementById("route-form-title").textContent = "Thêm tuyến mới";
  document.getElementById("route-submit").textContent = "Thêm";
  document.getElementById("route-cancel").hidden = true;
}

function deleteRoute(id) {
  openConfirm(
    "Ngừng / xoá tuyến",
    `Nếu tuyến đã có chuyến sẽ chuyển sang ngừng hoạt động. Tiếp tục với tuyến #${id}?`,
    async () => {
      try {
        const res = await api.delete(`${API_ROUTES}/${id}`);
        showToast(res.message || "Đã xử lý");
        if (editingRouteId === id) resetRouteForm();
        loadRoutes();
      } catch (e) {
        showToast(e.message, "error");
      }
    }
  );
}

routeBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit-route") startEditRoute(id);
  if (btn.dataset.action === "del-route") deleteRoute(id);
});

document.getElementById("route-cancel").onclick = resetRouteForm;

let routeTimer;
routeSearch.addEventListener("input", () => {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(loadRoutes, 300);
});

// ========== STATIONS ==========
const stationForm = document.getElementById("station-form");
const stationBody = document.getElementById("station-table-body");
const stationSearch = document.getElementById("station-search");
let editingStationId = null;

async function loadStations() {
  stationBody.innerHTML = `<tr><td colspan="6" class="muted">Đang tải...</td></tr>`;
  try {
    const q = stationSearch.value.trim();
    const stations = await api.get(API_STATIONS, q ? { q } : undefined);
    const list = Array.isArray(stations) ? stations : stations.items || [];
    renderStations(list);
    if (!q) {
      stationMap = {};
      list.forEach((s) => {
        stationMap[s.id] = s;
      });
      await refreshStationOptions();
    }
  } catch (e) {
    stationBody.innerHTML = `<tr><td colspan="6" class="text-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderStations(stations) {
  if (!stations.length) {
    stationBody.innerHTML = `<tr><td colspan="6" class="muted">Chưa có bến</td></tr>`;
    return;
  }
  stationBody.innerHTML = stations
    .map(
      (s) => `
    <tr>
      <td>${s.id}</td>
      <td>
        <strong>${escapeHtml(s.name)}</strong>
        <div class="muted">${escapeHtml(s.address || "")}</div>
      </td>
      <td>${escapeHtml(s.city || "")}</td>
      <td>${escapeHtml(s.phone || "")}</td>
      <td>
        <span class="badge ${s.is_active ? "badge-ok" : "badge-off"}">
          ${s.is_active ? "Hoạt động" : "Ngừng"}
        </span>
      </td>
      <td class="actions">
        <button class="btn btn-small" data-action="edit-station" data-id="${s.id}">Sửa</button>
        <button class="btn btn-small btn-danger" data-action="del-station" data-id="${s.id}">
          ${s.is_active ? "Ngừng" : "Xoá"}
        </button>
      </td>
    </tr>`
    )
    .join("");
}

stationForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: stationForm.name.value.trim(),
    city: stationForm.city.value.trim() || null,
    address: stationForm.address.value.trim() || null,
    phone: stationForm.phone.value.trim() || null,
    is_active: true,
  };
  try {
    if (editingStationId == null) {
      await api.post(API_STATIONS, data);
      showToast("Đã thêm bến");
    } else {
      await api.put(`${API_STATIONS}/${editingStationId}`, data);
      showToast("Đã cập nhật bến");
    }
    resetStationForm();
    loadStations();
    loadRoutes();
  } catch (err) {
    showToast(err.message, "error");
  }
});

async function startEditStation(id) {
  try {
    const s = await api.get(`${API_STATIONS}/${id}`);
    editingStationId = id;
    stationForm.name.value = s.name;
    stationForm.city.value = s.city ?? "";
    stationForm.address.value = s.address ?? "";
    stationForm.phone.value = s.phone ?? "";
    document.getElementById("station-form-title").textContent = `Sửa bến #${id}`;
    document.getElementById("station-submit").textContent = "Lưu";
    document.getElementById("station-cancel").hidden = false;
  } catch (e) {
    showToast(e.message, "error");
  }
}

function resetStationForm() {
  editingStationId = null;
  stationForm.reset();
  document.getElementById("station-form-title").textContent = "Thêm bến mới";
  document.getElementById("station-submit").textContent = "Thêm";
  document.getElementById("station-cancel").hidden = true;
}

function deleteStation(id) {
  openConfirm(
    "Ngừng / xoá bến",
    `Nếu bến đã có chuyến sẽ chuyển sang ngừng hoạt động. Tiếp tục với bến #${id}?`,
    async () => {
      try {
        const res = await api.delete(`${API_STATIONS}/${id}`);
        showToast(res.message || "Đã xử lý");
        if (editingStationId === id) resetStationForm();
        loadStations();
        loadRoutes();
      } catch (e) {
        showToast(e.message, "error");
      }
    }
  );
}

stationBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit-station") startEditStation(id);
  if (btn.dataset.action === "del-station") deleteStation(id);
});

document.getElementById("station-cancel").onclick = resetStationForm;

let stationTimer;
stationSearch.addEventListener("input", () => {
  clearTimeout(stationTimer);
  stationTimer = setTimeout(loadStations, 300);
});

// Khởi tạo
(async function init() {
  await refreshStationOptions();
  await loadStations();
  await loadRoutes();
})();