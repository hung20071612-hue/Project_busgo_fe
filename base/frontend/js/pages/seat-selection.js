const MAX_SEATS = 5;
const HOLD_TOTAL_SECONDS = 10 * 60;
const REFRESH_MS = 20000;

const urlParams = new URLSearchParams(window.location.search);
const state = {
  tripId: Number(urlParams.get("trip_id")),
  userId: null,
  map: null,
  tripDetail: null,
  bookingId: null,
  mySeats: new Set(),
  endsAt: null,
  timerId: null,
  refreshId: null,
  busy: false,
};

const holdStorageKey = () => `busgo_hold_${state.tripId}`;

function startCountdown(secondsLeft) {
  state.endsAt = Date.now() + secondsLeft * 1000;
  document.getElementById("timerCard").hidden = false;
  clearInterval(state.timerId);
  state.timerId = setInterval(tickCountdown, 1000);
  tickCountdown();
}

function stopCountdown() {
  clearInterval(state.timerId);
  state.timerId = null;
  document.getElementById("timerCard").hidden = true;
}

function tickCountdown() {
  const left = Math.ceil((state.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    stopCountdown();
    state.bookingId = null;
    state.mySeats.clear();
    sessionStorage.removeItem(holdStorageKey());
    showToast("Hết thời gian giữ ghế. Vui lòng chọn lại ghế.", "error");
    renderSeatMap();
    updateSummary();
    loadSeatMap();
    return;
  }
  const mins = String(Math.floor(left / 60)).padStart(2, "0");
  const secs = String(left % 60).padStart(2, "0");
  document.getElementById("timerText").textContent = `${mins}:${secs}`;
  const pct = Math.max(0, Math.min(100, (left / HOLD_TOTAL_SECONDS) * 100));
  document.getElementById("timerBar").style.width = `${pct}%`;
}

function getSeatState(seat) {
  if (state.mySeats.has(seat.seat_id)) return "selected";
  if (seat.status === "BOOKED") return "booked";
  if (seat.status === "HELD") return "held";
  return "available";
}

function renderSeatMap() {
  const container = document.getElementById("seatMap");
  if (!state.map || !state.map.seats) return;

  const floors = Number(state.map.floors || 1);
  const cols = Number(state.map.cols_per_floor || 2);
  const byFloor = {};
  state.map.seats.forEach((s) => {
    const f = s.floor || 1;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(s);
  });

  const wrapper = document.createElement("div");
  wrapper.className = "decks-wrap";

  Object.keys(byFloor)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((floorKey) => {
      const floorNum = Number(floorKey);
      const seats = byFloor[floorKey].sort((a, b) => a.row_num - b.row_num || a.col_num - b.col_num);
      const freeCount = seats.filter((s) => getSeatState(s) === "available").length;

      const deck = document.createElement("div");
      deck.className = "deck-card";

      const header = document.createElement("div");
      header.className = "deck-header";
      header.innerHTML = `
        <span>${floors > 1 ? (floorNum === 1 ? "Tầng 1 (Tầng dưới)" : "Tầng 2 (Tầng trên)") : "Sơ đồ khoang hành khách"}</span>
        <span class="muted">Trống: ${freeCount}/${seats.length}</span>`;
      deck.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "seat-grid-matrix";
      grid.style.gridTemplateColumns = `repeat(${cols}, 64px)`;

      const labelMap = { selected: "Đang chọn", booked: "Đã đặt", held: "Đang giữ", available: "Trống" };
      seats.forEach((seat) => {
        const kind = getSeatState(seat);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `seat-btn ${kind}`;
        btn.disabled = kind === "booked" || kind === "held";
        btn.innerHTML = `<span>${escapeHtml(seat.seat_code)}</span><small>${labelMap[kind]}</small>`;
        if (!btn.disabled) {
          btn.addEventListener("click", () => handleSeatToggle(seat));
        }
        grid.appendChild(btn);
      });

      deck.appendChild(grid);
      wrapper.appendChild(deck);
    });

  container.replaceChildren(wrapper);
}

function updateSummary() {
  const selectedIds = Array.from(state.mySeats);
  const listEl = document.getElementById("selectedSeatList");
  const continueBtn = document.getElementById("continueBtn");
  const releaseBtn = document.getElementById("releaseAllBtn");

  if (selectedIds.length === 0) {
    listEl.innerHTML = `<span class="muted">Chưa chọn ghế nào</span>`;
    document.getElementById("sumTotal").textContent = "0 ₫";
    continueBtn.disabled = true;
    releaseBtn.hidden = true;
    return;
  }

  const codeMap = {};
  (state.map?.seats || []).forEach((s) => {
    codeMap[s.seat_id] = s.seat_code;
  });

  listEl.innerHTML = selectedIds
    .map((id) => `<span class="seat-chip">${escapeHtml(codeMap[id] || "#" + id)}</span>`)
    .join("");

  const unitPrice = Number(state.map?.ticket_price || state.tripDetail?.ticket_price || 0);
  document.getElementById("sumTotal").textContent = formatMoney(unitPrice * selectedIds.length);
  continueBtn.disabled = false;
  releaseBtn.hidden = false;
}

async function handleSeatToggle(seat) {
  if (state.busy) return;
  const isSelected = state.mySeats.has(seat.seat_id);

  if (!isSelected && state.mySeats.size >= MAX_SEATS) {
    showToast(`Bạn chỉ được chọn tối đa ${MAX_SEATS} ghế mỗi lần đặt.`, "error");
    return;
  }

  state.busy = true;
  try {
    if (isSelected) {
      const res = await api.delete(`/holds/${state.bookingId}/seats/${seat.seat_id}?user_id=${state.userId}`);
      state.mySeats = new Set(res.seat_ids || []);
      if (state.mySeats.size === 0) {
        state.bookingId = null;
        sessionStorage.removeItem(holdStorageKey());
        stopCountdown();
      } else if (res.hold_seconds_left != null) {
        startCountdown(res.hold_seconds_left);
      }
      showToast(`Đã bỏ chọn ghế ${seat.seat_code}`);
    } else {
      const payload = {
        user_id: state.userId,
        seat_ids: [seat.seat_id],
        booking_id: state.bookingId,
      };
      const res = await api.post(`/trips/${state.tripId}/holds`, payload);
      state.bookingId = res.booking_id;
      state.mySeats = new Set(res.seat_ids || []);
      sessionStorage.setItem(holdStorageKey(), String(state.bookingId));
      if (res.hold_seconds_left != null) {
        startCountdown(res.hold_seconds_left);
      }
      showToast(`Đang giữ ghế ${seat.seat_code} trong 10 phút`);
    }
    await loadSeatMap();
  } catch (error) {
    showToast(error.message || "Không thể cập nhật trạng thái ghế", "error");
    await loadSeatMap();
  } finally {
    state.busy = false;
  }
}

async function releaseAllSeats() {
  if (!state.bookingId || state.busy) return;
  state.busy = true;
  try {
    await api.delete(`/holds/${state.bookingId}?user_id=${state.userId}`);
    state.bookingId = null;
    state.mySeats.clear();
    sessionStorage.removeItem(holdStorageKey());
    stopCountdown();
    showToast("Đã bỏ chọn toàn bộ ghế");
    await loadSeatMap();
  } catch (error) {
    showToast(error.message || "Không thể nhả ghế", "error");
  } finally {
    state.busy = false;
  }
}

async function loadSeatMap() {
  const data = await api.get(`/trips/${state.tripId}/seats`);
  state.map = data;
  document.getElementById("busTitle").textContent = `Chọn ghế · ${data.bus_type_name || "Xe khách"}`;
  document.getElementById("busSubtitle").textContent = `Biển số ${data.plate_number} · Giá vé ${formatMoney(data.ticket_price)} / ghế`;
  document.getElementById("sumPlate").textContent = data.plate_number || "—";
  document.getElementById("sumUnitPrice").textContent = formatMoney(data.ticket_price);
  renderSeatMap();
  updateSummary();
}

async function restoreExistingHold() {
  const savedBookingId = Number(urlParams.get("booking_id") || sessionStorage.getItem(holdStorageKey()));
  if (!savedBookingId) return;
  try {
    const hold = await api.get(`/holds/${savedBookingId}`, { user_id: state.userId });
    if (hold && hold.seat_ids && hold.seat_ids.length > 0 && hold.hold_seconds_left > 0) {
      state.bookingId = hold.booking_id;
      state.mySeats = new Set(hold.seat_ids);
      sessionStorage.setItem(holdStorageKey(), String(state.bookingId));
      startCountdown(hold.hold_seconds_left);
    } else {
      sessionStorage.removeItem(holdStorageKey());
    }
  } catch (e) {
    sessionStorage.removeItem(holdStorageKey());
  }
}

(async function initSeatSelection() {
  if (!state.tripId) {
    document.getElementById("seatMap").innerHTML = `<div class="card text-error">Thiếu mã chuyến xe (trip_id).</div>`;
    return;
  }

  state.userId = await requireAuthenticatedUserId();
  if (!state.userId) return;

  try {
    state.tripDetail = await api.get(`/trips/${state.tripId}/details`);
    document.getElementById("sumRoute").textContent = `${state.tripDetail.origin_station} → ${state.tripDetail.dest_station}`;
    document.getElementById("sumDeparture").textContent = formatDateTime(state.tripDetail.departure_at);
  } catch (e) {
    // Bỏ qua nếu không tải được details phụ
  }

  await restoreExistingHold();
  await loadSeatMap();

  state.refreshId = setInterval(() => {
    if (!state.busy) loadSeatMap().catch(() => {});
  }, REFRESH_MS);

  document.getElementById("releaseAllBtn").addEventListener("click", releaseAllSeats);
  document.getElementById("continueBtn").addEventListener("click", () => {
    if (!state.bookingId || state.mySeats.size === 0) return;
    window.location.href = `passenger-info.html?booking_id=${encodeURIComponent(state.bookingId)}&trip_id=${encodeURIComponent(state.tripId)}`;
  });
})();