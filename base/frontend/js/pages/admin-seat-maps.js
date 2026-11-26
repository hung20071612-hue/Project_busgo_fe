(() => {
  let busTypes = [];
  let selectedBusType = null;
  let currentSeats = [];

  function renderBusTypesList() {
    const container = document.getElementById("bustypes-list");
    document.getElementById("bustype-count").textContent = busTypes.length;

    if (busTypes.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-400 py-4">Chưa có loại xe nào. Hãy bấm "Thêm loại xe".</p>`;
      return;
    }

    container.innerHTML = busTypes
      .map((bt) => {
        const isSelected = selectedBusType && Number(selectedBusType.id) === Number(bt.id);
        const typeLabel = bt.seat_type === "berth" ? "Giường nằm" : "Ghế ngồi";
        const statusDot =
          bt.is_active === false
            ? `<span class="text-[11px] font-semibold text-rose-500">• Ngừng</span>`
            : "";

        return `
          <button
            type="button"
            data-bt-id="${bt.id}"
            class="bt-item w-full text-left p-3.5 rounded-xl border transition ${
              isSelected
                ? "bg-brand-50 border-brand-500 shadow-xs"
                : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-brand-300"
            }"
          >
            <div class="font-display font-bold text-sm text-slate-900">${bt.name} ${statusDot}</div>
            <div class="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>${bt.total_seats} chỗ • ${bt.floors} tầng • ${typeLabel}</span>
              <span class="text-brand-600 font-semibold">Xem sơ đồ →</span>
            </div>
          </button>
        `;
      })
      .join("");
  }

  function renderSeatMap() {
    const editor = document.getElementById("seatmap-editor");
    const placeholder = document.getElementById("seatmap-placeholder");
    if (!selectedBusType) {
      editor.classList.add("hidden");
      placeholder.classList.remove("hidden");
      return;
    }

    placeholder.classList.add("hidden");
    editor.classList.remove("hidden");

    const typeLabel = selectedBusType.seat_type === "berth" ? "Giường nằm" : "Ghế ngồi";
    document.getElementById("selected-bustype-name").textContent = selectedBusType.name;
    document.getElementById("selected-bustype-meta").textContent =
      `Cấu hình: ${selectedBusType.floors} tầng × ${selectedBusType.rows_per_floor} hàng × ${selectedBusType.cols_per_floor} cột (${selectedBusType.total_seats} ${typeLabel.toLowerCase()})`;

    const floor1 = currentSeats.filter((s) => Number(s.floor || 1) === 1);
    const floor2 = currentSeats.filter((s) => Number(s.floor || 1) === 2);
    const cols = Math.min(Math.max(Number(selectedBusType.cols_per_floor || 2), 1), 6);

    const renderDeckBox = (title, seats, showWheel = false) => `
      <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <span class="font-display font-bold text-sm text-slate-800">${title} (${seats.length} chỗ)</span>
          ${
            showWheel
              ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><span class="material-symbols-outlined text-[16px]">motion_photos_auto</span> Tài xế</span>`
              : ""
          }
        </div>
        <div class="grid gap-2.5" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
          ${seats
            .map((s) => {
              const active = s.is_active !== false;
              const code = s.seat_code || s.seat_number || "---";
              return `
                <div
                  class="py-2.5 px-2 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1 ${
                    active
                      ? "bg-white border-2 border-brand-500 text-slate-900 shadow-2xs"
                      : "bg-slate-200 border border-slate-300 text-slate-400 line-through"
                  }"
                >
                  <span class="material-symbols-outlined text-[15px] ${active ? "text-brand-500" : "text-slate-400"}">event_seat</span>
                  ${code}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    const decksEl = document.getElementById("decks-container");
    if (Number(selectedBusType.floors) === 2 || floor2.length > 0) {
      decksEl.className = "grid grid-cols-1 md:grid-cols-2 gap-6";
      decksEl.innerHTML =
        renderDeckBox("Tầng 1 (Tầng dưới)", floor1, true) +
        renderDeckBox("Tầng 2 (Tầng trên)", floor2, false);
    } else {
      decksEl.className = "grid grid-cols-1 max-w-md mx-auto gap-6";
      decksEl.innerHTML = renderDeckBox("Sơ đồ 1 tầng", floor1, true);
    }
  }

  async function selectBusType(bt) {
    selectedBusType = bt;
    renderBusTypesList();

    try {
      const seats = await api.get(`/admin/bus-types/${bt.id}/seats`);
      currentSeats = Array.isArray(seats) ? seats : seats.items || [];
    } catch (err) {
      currentSeats = [];
      alert(`Không tải được sơ đồ ghế: ${err.message}`);
    }

    renderSeatMap();
  }

  async function loadBusTypes(selectId = null) {
    try {
      const data = await api.get("/admin/bus-types");
      busTypes = Array.isArray(data) ? data : data.items || [];
      renderBusTypesList();

      if (busTypes.length > 0) {
        const target =
          (selectId && busTypes.find((b) => Number(b.id) === Number(selectId))) ||
          (selectedBusType && busTypes.find((b) => Number(b.id) === Number(selectedBusType.id))) ||
          busTypes[0];
        await selectBusType(target);
      } else {
        selectedBusType = null;
        renderSeatMap();
      }
    } catch (err) {
      document.getElementById("bustypes-list").innerHTML =
        `<p class="text-sm text-rose-600 font-medium">Lỗi tải danh sách loại xe: ${err.message}</p>`;
    }
  }

  function updateTotalPreview() {
    const floors = Number(document.getElementById("bt-floors").value) || 1;
    const rows = Number(document.getElementById("bt-rows").value) || 1;
    const cols = Number(document.getElementById("bt-cols").value) || 1;
    const total = floors * rows * cols;
    document.getElementById("bt-total-preview").innerHTML =
      `Tổng sức chứa tự động sinh: <strong>${total}</strong> ghế (${floors} tầng × ${rows} hàng × ${cols} cột)`;
  }

  function openBusTypeModal(bt = null) {
    const modal = document.getElementById("bustype-modal");
    const titleEl = document.getElementById("bt-modal-title");
    const idEl = document.getElementById("edit-bt-id");

    if (bt) {
      titleEl.textContent = `Cập nhật loại xe: ${bt.name}`;
      idEl.value = bt.id;
      document.getElementById("bt-name").value = bt.name;
      document.getElementById("bt-floors").value = String(bt.floors || 1);
      document.getElementById("bt-seat-type").value = bt.seat_type || "seat";
      document.getElementById("bt-rows").value = bt.rows_per_floor || 10;
      document.getElementById("bt-cols").value = bt.cols_per_floor || 2;
      document.getElementById("bt-desc").value = bt.description || "";
    } else {
      titleEl.textContent = "Thêm loại xe mới";
      idEl.value = "";
      document.getElementById("bustype-form").reset();
      document.getElementById("bt-floors").value = "2";
      document.getElementById("bt-seat-type").value = "berth";
      document.getElementById("bt-rows").value = "10";
      document.getElementById("bt-cols").value = "2";
    }

    updateTotalPreview();
    modal.classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadBusTypes();

    ["bt-floors", "bt-rows", "bt-cols"].forEach((id) => {
      document.getElementById(id).addEventListener("input", updateTotalPreview);
      document.getElementById(id).addEventListener("change", updateTotalPreview);
    });

    document.getElementById("bustypes-list").addEventListener("click", (e) => {
      const btn = e.target.closest(".bt-item");
      if (!btn) return;
      const bt = busTypes.find((b) => Number(b.id) === Number(btn.dataset.btId));
      if (bt) selectBusType(bt);
    });

    document.getElementById("btn-new-bustype")?.addEventListener("click", () => openBusTypeModal(null));
    document.getElementById("btn-edit-bustype")?.addEventListener("click", () => {
      if (selectedBusType) openBusTypeModal(selectedBusType);
    });

    document.getElementById("btn-delete-bustype").addEventListener("click", async () => {
      if (!selectedBusType) return;
      if (!confirm(`Xóa / ngừng loại xe "${selectedBusType.name}"?`)) return;

      try {
        const res = await api.delete(`/admin/bus-types/${selectedBusType.id}`);
        if (res?.message) alert(res.message);
        selectedBusType = null;
        await loadBusTypes();
      } catch (err) {
        alert(`Xóa loại xe thất bại: ${err.message}`);
      }
    });

    const modal = document.getElementById("bustype-modal");
    document.getElementById("btn-close-bt-modal").addEventListener("click", () => modal.classList.add("hidden"));
    document.getElementById("btn-cancel-bt").addEventListener("click", () => modal.classList.add("hidden"));

    document.getElementById("bustype-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const editId = document.getElementById("edit-bt-id").value;
      const payload = {
        name: document.getElementById("bt-name").value.trim(),
        floors: Number(document.getElementById("bt-floors").value),
        rows_per_floor: Number(document.getElementById("bt-rows").value),
        cols_per_floor: Number(document.getElementById("bt-cols").value),
        seat_type: document.getElementById("bt-seat-type").value,
        description: document.getElementById("bt-desc").value.trim() || null,
        is_active: true,
      };

      const saveBtn = document.getElementById("btn-save-bt");
      saveBtn.disabled = true;
      saveBtn.textContent = "Đang lưu...";

      try {
        let saved;
        if (editId) {
          saved = await api.put(`/admin/bus-types/${editId}`, payload);
        } else {
          saved = await api.post("/admin/bus-types", payload);
        }
        modal.classList.add("hidden");
        await loadBusTypes(saved?.id);
      } catch (err) {
        alert(`Lưu loại xe thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Lưu loại xe";
      }
    });
  });
})();