// API: /admin/buses + /admin/bus-types + /admin/bus-types/{id}/seats
const API_BUS = "/admin/buses";
const API_BT = "/admin/bus-types";
const SIZE = 10;
let page = 1;
let editingId = null;
let typeMap = {};

const form = document.getElementById("bus-form");
const tableBody = document.getElementById("table-body");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const pagerEl = document.getElementById("pager");
const typeSelect = document.getElementById("bus-type-select");

function statusBadge(st) {
  if (st === "active") return `<span class="badge badge-ok">Hoạt động</span>`;
  if (st === "maintenance") return `<span class="badge badge-warn">Bảo dưỡng</span>`;
  return `<span class="badge badge-off">${escapeHtml(st)}</span>`;
}

function normalize(res) {
  if (Array.isArray(res)) return { items: res, total: res.length, page: 1, pages: 1 };
  return {
    items: res.items || [],
    total: res.total ?? 0,
    page: res.page ?? 1,
    pages: res.pages ?? 1,
  };
}

function renderPager(data) {
  const { page: p, pages, total } = data;
  if (pages <= 1) {
    pagerEl.innerHTML = total ? `<span>Tổng ${total}</span>` : "";
    return;
  }
  let html = `<button ${p <= 1 ? "disabled" : ""} data-p="${p - 1}">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="${i === p ? "active" : ""}" data-p="${i}">${i}</button>`;
  }
  html += `<button ${p >= pages ? "disabled" : ""} data-p="${p + 1}">›</button>`;
  html += `<span> / ${total}</span>`;
  pagerEl.innerHTML = html;
  pagerEl.querySelectorAll("button[data-p]").forEach((b) => {
    b.onclick = () => {
      page = Number(b.dataset.p);
      loadList();
    };
  });
}

async function loadTypes() {
  try {
    const res = await api.get(API_BT);
    const list = Array.isArray(res) ? res : res.items || [];
    typeMap = {};
    list.forEach((t) => {
      typeMap[t.id] = t;
    });
    typeSelect.innerHTML =
      `<option value="">-- Chọn loại xe --</option>` +
      list
        .filter((t) => t.is_active !== false)
        .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
        .join("");
  } catch (e) {
    console.warn(e.message);
  }
}

async function loadList() {
  tableBody.innerHTML = `<tr><td colspan="4" class="muted">Đang tải...</td></tr>`;
  try {
    const q = searchInput.value.trim();
    const status = statusFilter.value || undefined;
    const res = await api.get(API_BUS, {
      q: q || undefined,
      status,
      page,
      size: SIZE,
    });
    const data = normalize(res);
    if (!data.items.length) {
      tableBody.innerHTML = `<tr><td colspan="4" class="muted">Chưa có xe</td></tr>`;
    } else {
      tableBody.innerHTML = data.items
        .map(
          (b) => `
        <tr>
          <td><strong>${escapeHtml(b.plate_number)}</strong></td>
          <td>${escapeHtml(typeMap[b.bus_type_id]?.name || "#" + b.bus_type_id)}</td>
          <td>${statusBadge(b.status)}</td>
          <td class="actions">
            <button class="btn btn-small" data-act="map" data-type="${b.bus_type_id}">Sơ đồ</button>
            <button class="btn btn-small" data-act="edit" data-id="${b.id}">Sửa</button>
            <button class="btn btn-small btn-danger" data-act="del" data-id="${b.id}">Xoá</button>
          </td>
        </tr>`
        )
        .join("");
    }
    renderPager(data);
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    plate_number: form.plate_number.value.trim(),
    bus_type_id: Number(form.bus_type_id.value),
    status: form.status.value,
    note: form.note.value.trim() || null,
  };
  try {
    if (editingId == null) {
      await api.post(API_BUS, data);
      showToast("Đã thêm xe");
    } else {
      await api.put(`${API_BUS}/${editingId}`, data);
      showToast("Đã cập nhật xe");
    }
    resetForm();
    loadList();
  } catch (err) {
    showToast(err.message, "error");
  }
});

async function startEdit(id) {
  try {
    const b = await api.get(`${API_BUS}/${id}`);
    editingId = id;
    form.plate_number.value = b.plate_number;
    form.bus_type_id.value = b.bus_type_id;
    form.status.value = b.status;
    form.note.value = b.note ?? "";
    document.getElementById("form-title").textContent = `Sửa xe #${id}`;
    document.getElementById("btn-submit").textContent = "Lưu";
    document.getElementById("btn-cancel").hidden = false;
  } catch (e) {
    showToast(e.message, "error");
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById("form-title").textContent = "Thêm xe mới";
  document.getElementById("btn-submit").textContent = "Thêm";
  document.getElementById("btn-cancel").hidden = true;
}

function askDelete(id) {
  openConfirm(
    "Xoá / bảo dưỡng xe",
    `Xe #${id}: đã có chuyến thì chuyển bảo dưỡng.`,
    async () => {
      try {
        const res = await api.delete(`${API_BUS}/${id}`);
        showToast(res.message || "Đã xử lý");
        if (editingId === id) resetForm();
        loadList();
      } catch (e) {
        showToast(e.message, "error");
      }
    }
  );
}

async function showSeatMap(typeId) {
  const t = typeMap[typeId];
  const box = document.getElementById("seat-preview");
  const map = document.getElementById("seat-map");
  box.hidden = false;
  document.getElementById("seat-title").textContent =
    `Sơ đồ ghế — ${t ? t.name : "loại #" + typeId}`;
  map.innerHTML = `<p class="muted">Đang tải...</p>`;
  try {
    const seats = await api.get(`${API_BT}/${typeId}/seats`);
    if (!seats.length) {
      map.innerHTML = `<p class="muted">Chưa có ghế</p>`;
      return;
    }
    const byFloor = {};
    seats.forEach((s) => {
      (byFloor[s.floor] ||= []).push(s);
    });
    map.innerHTML = Object.keys(byFloor)
      .sort()
      .map((floor) => {
        const list = byFloor[floor].sort(
          (a, b) => a.row_num - b.row_num || a.col_num - b.col_num
        );
        const cols = Math.max(...list.map((s) => s.col_num));
        return `
          <div>
            <div class="seat-floor-title">Tầng ${floor} · ${list.length} chỗ</div>
            <div class="seat-grid" style="grid-template-columns: repeat(${cols}, minmax(48px,1fr))">
              ${list
                .map(
                  (s) =>
                    `<div class="seat-cell ${s.seat_type}">${escapeHtml(s.seat_code)}</div>`
                )
                .join("")}
            </div>
          </div>`;
      })
      .join("");
  } catch (e) {
    map.innerHTML = `<p class="text-error">${escapeHtml(e.message)}</p>`;
  }
}

document.getElementById("seat-close").onclick = () => {
  document.getElementById("seat-preview").hidden = true;
};

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "edit") startEdit(Number(btn.dataset.id));
  if (btn.dataset.act === "del") askDelete(Number(btn.dataset.id));
  if (btn.dataset.act === "map") showSeatMap(Number(btn.dataset.type));
});

document.getElementById("btn-cancel").onclick = resetForm;

let timer;
searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page = 1;
    loadList();
  }, 300);
});
statusFilter.addEventListener("change", () => {
  page = 1;
  loadList();
});

let confirmCb = null;
function openConfirm(title, msg, cb) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = msg;
  confirmCb = cb;
  document.getElementById("confirm-modal").classList.add("show");
}
document.getElementById("confirm-cancel").onclick = () => {
  document.getElementById("confirm-modal").classList.remove("show");
  confirmCb = null;
};
document.getElementById("confirm-ok").onclick = async () => {
  document.getElementById("confirm-modal").classList.remove("show");
  if (confirmCb) await confirmCb();
  confirmCb = null;
};

(async function init() {
  await loadTypes();
  await loadList();
})();