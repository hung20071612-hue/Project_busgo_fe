// API: /admin/bus-types + /admin/bus-types/{id}/seats
const API = "/admin/bus-types";
const SIZE = 10;
let page = 1;
let editingId = null;

const form = document.getElementById("bt-form");
const tableBody = document.getElementById("table-body");
const searchInput = document.getElementById("search-input");
const pagerEl = document.getElementById("pager");

function badge(active) {
  return active
    ? `<span class="badge badge-ok">Hoạt động</span>`
    : `<span class="badge badge-off">Ngừng</span>`;
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

async function loadList() {
  tableBody.innerHTML = `<tr><td colspan="6" class="muted">Đang tải...</td></tr>`;
  try {
    const q = searchInput.value.trim();
    const res = await api.get(API, { q: q || undefined, page, size: SIZE });
    const data = normalize(res);
    if (!data.items.length) {
      tableBody.innerHTML = `<tr><td colspan="6" class="muted">Chưa có dữ liệu</td></tr>`;
    } else {
      tableBody.innerHTML = data.items
        .map(
          (t) => `
        <tr>
          <td>${t.id}</td>
          <td>
            <strong>${escapeHtml(t.name)}</strong>
            <div class="muted">${escapeHtml(t.description || "")}</div>
          </td>
          <td>${t.floors}</td>
          <td>${t.total_seats}</td>
          <td>${badge(t.is_active)}</td>
          <td class="actions">
            <button class="btn btn-small" data-act="map" data-id="${t.id}" data-name="${escapeHtml(t.name)}">Sơ đồ</button>
            <button class="btn btn-small" data-act="edit" data-id="${t.id}">Sửa</button>
            <button class="btn btn-small btn-danger" data-act="del" data-id="${t.id}">Xoá</button>
          </td>
        </tr>`
        )
        .join("");
    }
    renderPager(data);
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: form.name.value.trim(),
    floors: Number(form.floors.value),
    rows_per_floor: Number(form.rows_per_floor.value),
    cols_per_floor: Number(form.cols_per_floor.value),
    seat_type: form.seat_type.value,
    description: form.description.value.trim() || null,
    is_active: true,
  };
  try {
    if (editingId == null) {
      await api.post(API, data);
      showToast("Đã thêm loại xe (tự sinh ghế)");
    } else {
      await api.put(`${API}/${editingId}`, data);
      showToast("Đã cập nhật loại xe");
    }
    resetForm();
    loadList();
  } catch (err) {
    showToast(err.message, "error");
  }
});

async function startEdit(id) {
  try {
    const t = await api.get(`${API}/${id}`);
    editingId = id;
    form.name.value = t.name;
    form.floors.value = String(t.floors);
    form.rows_per_floor.value = t.rows_per_floor;
    form.cols_per_floor.value = t.cols_per_floor;
    form.seat_type.value = t.seat_type;
    form.description.value = t.description ?? "";
    document.getElementById("form-title").textContent = `Sửa loại xe #${id}`;
    document.getElementById("btn-submit").textContent = "Lưu";
    document.getElementById("btn-cancel").hidden = false;
  } catch (e) {
    showToast(e.message, "error");
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById("form-title").textContent = "Thêm loại xe mới";
  document.getElementById("btn-submit").textContent = "Thêm";
  document.getElementById("btn-cancel").hidden = true;
}

function askDelete(id) {
  openConfirm(
    "Xoá / ngừng loại xe",
    `Loại #${id}: đã có chuyến thì chỉ ngừng hoạt động.`,
    async () => {
      try {
        const res = await api.delete(`${API}/${id}`);
        showToast(res.message || "Đã xử lý");
        if (editingId === id) resetForm();
        loadList();
      } catch (e) {
        showToast(e.message, "error");
      }
    }
  );
}

async function showSeatMap(id, name) {
  const box = document.getElementById("seat-preview");
  const map = document.getElementById("seat-map");
  box.hidden = false;
  document.getElementById("seat-title").textContent = `Sơ đồ ghế — ${name}`;
  map.innerHTML = `<p class="muted">Đang tải...</p>`;
  try {
    const seats = await api.get(`${API}/${id}/seats`);
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
  const id = Number(btn.dataset.id);
  if (btn.dataset.act === "edit") startEdit(id);
  if (btn.dataset.act === "del") askDelete(id);
  if (btn.dataset.act === "map") showSeatMap(id, btn.dataset.name || "");
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

loadList();