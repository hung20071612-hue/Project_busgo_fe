/* Trang chọn ghế: vẽ sơ đồ, chọn nhiều ghế, tổng tiền, đếm ngược giữ ghế.
 *
 * Mở trang:  seat-selection.html?trip_id=1
 * API dùng:
 *   GET    /api/trips/{trip_id}/seats                   sơ đồ ghế
 *   POST   /api/trips/{trip_id}/holds                   giữ ghế (khi bấm chọn)
 *   DELETE /api/holds/{booking_id}/seats/{seat_id}      nhả 1 ghế (khi bỏ chọn)
 *   DELETE /api/holds/{booking_id}                      nhả tất cả
 *   GET    /api/holds/{booking_id}                      lấy lại phiên giữ khi tải lại trang
 */

// ====== CẤU HÌNH (sửa cho khớp project) ======
// Nếu frontend/js/config.js đã có biến địa chỉ API thì dùng lại nó ở đây.
const API_BASE = window.API_BASE_URL || "http://127.0.0.1:8000/api";
const NEXT_PAGE = "passenger-info.html"; // trang nhập hành khách (task kế tiếp)
const MAX_SEATS = 5;
const HOLD_TOTAL_SECONDS = 10 * 60;
const REFRESH_MS = 20000; // tự tải lại sơ đồ để thấy ghế người khác giữ/đặt

// TẠM: chưa có đăng nhập nên lấy user_id từ ?user_id=..., localStorage, hoặc user test.
// Khi có JWT thì bỏ hàm này và gửi token qua header Authorization.
function getUserId() {
  const params = new URLSearchParams(location.search);
  return params.get("user_id") || localStorage.getItem("user_id") || "U0001";
}

// ====== TRẠNG THÁI ======
const params = new URLSearchParams(location.search);
const state = {
  tripId: Number(params.get("trip_id")),
  userId: getUserId(),
  map: null,
  bookingId: null,
  mySeats: new Set(),
  holdTotal: null,
  endsAt: null,
  timerId: null,
  busy: false,
};

const $ = (id) => document.getElementById(id);
const holdKey = () => `busgo_hold_${state.tripId}`;
const money = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + " đ";

// ====== GỌI API ======
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { /* không có body */ }
  if (!res.ok) {
    let message = "Có lỗi xảy ra, vui lòng thử lại";
    if (data && typeof data.detail === "string") message = data.detail;
    else if (data && Array.isArray(data.detail)) message = "Dữ liệu gửi lên không hợp lệ";
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

// ====== THÔNG BÁO ======
let toastTimer = null;
function showToast(message) {
  const el = $("toast");
  el.textContent = message; 
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
}

// ====== VẼ SƠ ĐỒ GHẾ ======
const SEAT_BASE = "w-14 h-11 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all";

function seatClasses(kind) {
  switch (kind) {
    case "selected":
      return `${SEAT_BASE} bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300`;
    case "booked":
      return `${SEAT_BASE} border-2 border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed`;
    case "held":
      return `${SEAT_BASE} border-2 border-amber-200 bg-amber-50 text-amber-600 cursor-not-allowed`;
    default:
      return `${SEAT_BASE} border-2 border-slate-300 bg-white hover:border-orange-500 text-slate-700 shadow-sm hover:shadow group`;
  }
}

function seatKind(seat) {
  if (state.mySeats.has(seat.seat_id)) return "selected";
  if (seat.status === "BOOKED") return "booked";
  if (seat.status === "HELD") return "held";
  return "available";
}

const SUBTITLE = { selected: "Đang chọn", booked: "Đã đặt", held: "Đang giữ", available: "Trống" };

function createSeatButton(seat) {
  const kind = seatKind(seat);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = seatClasses(kind);
  btn.disabled = kind === "booked" || kind === "held";
  btn.setAttribute("aria-label", `Ghế ${seat.seat_code} - ${SUBTITLE[kind]}`);
  btn.setAttribute("aria-pressed", kind === "selected" ? "true" : "false");

  const code = document.createElement("span");
  code.textContent = seat.seat_code;
  const sub = document.createElement("span");
  sub.textContent = SUBTITLE[kind];
  sub.className =
    kind === "selected" ? "text-[9px] text-orange-100 font-medium"
    : kind === "available" ? "text-[9px] text-slate-400 font-normal group-hover:text-orange-500"
    : "text-[9px] font-medium";
  btn.append(code, sub);

  if (!btn.disabled) btn.addEventListener("click", () => onSeatClick(seat));
  return btn;
}

function createDeck(floor, seats, totalFloors, cols) {
  const deck = document.createElement("div");
  deck.className = "bg-white rounded-xl border border-slate-200 p-3 shadow-sm";

  const free = seats.filter((s) => seatKind(s) === "available").length;
  const title = totalFloors === 1 ? "Sơ đồ ghế" : floor === 1 ? "Tầng dưới" : "Tầng trên";
  const dot = floor === 1 ? "bg-blue-600" : "bg-teal-600";

  const head = document.createElement("div");
  head.className = "flex items-center justify-between mb-3 pb-2 border-b border-slate-100";
  head.innerHTML =
    `<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full ${dot}"></span>` +
    `<span class="font-headline text-xs font-bold text-slate-800 uppercase"></span></div>` +
    `<span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded"></span>`;
  head.querySelector("span.font-headline").textContent = title;
  head.lastElementChild.textContent = `${free} trống`;
  deck.appendChild(head);

  // Thanh tài xế (tầng 1) hoặc cầu thang (tầng 2) giống thiết kế mẫu
  const bar = document.createElement("div");
  if (floor === 1) {
    bar.className = "mb-3 p-2 bg-slate-100 rounded-lg flex items-center justify-between border border-dashed border-slate-300";
    bar.innerHTML =
      `<div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">` +
      `<span class="material-symbols-outlined text-slate-500 text-[18px]">sports_motorsports</span><span>Tài xế</span></div>` +
      `<div class="flex items-center gap-1 text-[10px] text-slate-500 font-medium">` +
      `<span class="material-symbols-outlined text-[16px] text-emerald-600">door_front</span><span>Cửa lên</span></div>`;
  } else {
    bar.className = "mb-3 p-2 bg-teal-50/70 rounded-lg flex items-center justify-between border border-dashed border-teal-200";
    bar.innerHTML =
      `<div class="flex items-center gap-1.5 text-[11px] font-semibold text-teal-800">` +
      `<span class="material-symbols-outlined text-teal-700 text-[18px]">stairs</span><span>Cầu thang lên</span></div>`;
  }
  deck.appendChild(bar);

  // Lưới ghế theo hàng/cột; ô không có ghế để trống cho thẳng hàng
  const byPos = new Map(seats.map((s) => [`${s.row_num}-${s.col_num}`, s]));
  const rows = [...new Set(seats.map((s) => s.row_num))].sort((a, b) => a - b);
  const aisleAfter = cols >= 2 ? Math.floor(cols / 2) : 0;

  const grid = document.createElement("div");
  grid.className = "space-y-2 overflow-x-auto";
  rows.forEach((r) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-center gap-1.5";
    for (let c = 1; c <= cols; c++) {
      const seat = byPos.get(`${r}-${c}`);
      if (seat) row.appendChild(createSeatButton(seat));
      else {
        const gap = document.createElement("div");
        gap.className = "w-14 h-11";
        row.appendChild(gap);
      }
      if (c === aisleAfter && c < cols) {
        const aisle = document.createElement("span");
        aisle.className = "text-[10px] text-slate-300 font-mono px-1";
        aisle.textContent = "||";
        row.appendChild(aisle);
      }
    }
    grid.appendChild(row);
  });
  deck.appendChild(grid);
  return deck;
}

function renderMap() {
  const map = state.map;
  const container = $("seatMap");
  container.innerHTML = "";
  if (!map || !map.seats.length) {
    container.innerHTML =
      '<div class="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">Chuyến này chưa có sơ đồ ghế.</div>';
    return;
  }
  const floors = [...new Set(map.seats.map((s) => s.floor))].sort((a, b) => a - b);
  const cols = Math.max(map.cols_per_floor || 0, ...map.seats.map((s) => s.col_num));
  const wrap = document.createElement("div");
  wrap.className = floors.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-3.5" : "max-w-sm";
  floors.forEach((f) => {
    wrap.appendChild(createDeck(f, map.seats.filter((s) => s.floor === f), floors.length, cols));
  });
  container.appendChild(wrap);
}

// ====== TÓM TẮT BÊN PHẢI ======
function unitPrice() {
  if (state.map && state.map.price != null) return Number(state.map.price);
  if (state.holdTotal != null && state.mySeats.size) return state.holdTotal / state.mySeats.size;
  return 0;
}

function renderSummary() {
  const map = state.map;
  if (map) {
    $("busTitle").textContent = map.bus_type_name;
    $("busSubtitle").textContent = `${map.total_seats} chỗ · ${map.floors} tầng`;
    $("infoTrip").textContent = `#${map.trip_id}`;
    $("infoBus").textContent = map.bus_type_name;
    $("infoPrice").textContent = map.price != null ? money(map.price) : "-";
    $("infoAvailable").textContent = `${map.seats.filter((s) => seatKind(s) === "available").length} / ${map.total_seats}`;
    $("infoDeparture").textContent = map.departure_time
      ? new Date(map.departure_time).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
      : "-";
  }

  const count = state.mySeats.size;
  $("selectedCount").textContent = `${count} / ${MAX_SEATS}`;
  const list = $("selectedList");
  list.innerHTML = "";
  if (!count) {
    const none = document.createElement("span");
    none.className = "text-sm text-slate-400";
    none.textContent = "Chưa chọn ghế nào";
    list.appendChild(none);
  } else {
    const byId = new Map((map ? map.seats : []).map((s) => [s.seat_id, s]));
    [...state.mySeats].sort((a, b) => a - b).forEach((id) => {
      const chip = document.createElement("span");
      chip.className = "px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold";
      chip.textContent = byId.get(id) ? byId.get(id).seat_code : `#${id}`;
      list.appendChild(chip);
    });
  }

  // Tổng tiền cập nhật ngay theo số ghế đã chọn
  $("totalPrice").textContent = money(unitPrice() * count);

  $("clearBtn").disabled = !count;
  const cont = $("continueBtn");
  if (count && state.bookingId) {
    cont.href = `${NEXT_PAGE}?trip_id=${state.tripId}&booking_id=${state.bookingId}`;
    cont.classList.remove("pointer-events-none", "opacity-40");
    cont.setAttribute("aria-disabled", "false");
  } else {
    cont.href = "#";
    cont.classList.add("pointer-events-none", "opacity-40");
    cont.setAttribute("aria-disabled", "true");
  }
}

function render() {
  renderMap();
  renderSummary();
}

// ====== ĐỒNG HỒ ĐẾM NGƯỢC ======
function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
  state.endsAt = null;
  $("timerCard").classList.add("hidden");
}

function startTimer(secondsLeft) {
  // Dùng số giây server trả về (không tin đồng hồ máy khách)
  state.endsAt = Date.now() + secondsLeft * 1000;
  $("timerCard").classList.remove("hidden");
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
  tick();
}

function tick() {
  const left = Math.ceil((state.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    onExpired();
    return;
  }
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  $("timerText").textContent = `${mm}:${ss}`;
  $("timerBar").style.width = `${Math.min(100, (left / HOLD_TOTAL_SECONDS) * 100)}%`;
  const urgent = left <= 60; // dưới 1 phút: đổi sang màu đỏ
  $("timerCard").className = `rounded-xl border p-4 ${urgent ? "border-rose-200 bg-rose-50" : "border-orange-200 bg-orange-50"}`;
  $("timerText").className = `font-headline text-2xl font-extrabold tabular-nums ${urgent ? "text-rose-600" : "text-orange-600"}`;
  $("timerBar").className = `h-full transition-all duration-1000 ease-linear ${urgent ? "bg-rose-500" : "bg-orange-500"}`;
}

async function onExpired() {
  stopTimer();
  clearLocalHold();
  $("expiredModal").classList.remove("hidden");
  $("expiredModal").classList.add("flex");
  await loadMap(); // tải lại sơ đồ: ghế hết hạn trở về trống
}

// ====== PHIÊN GIỮ GHẾ ======
function clearLocalHold() {
  state.bookingId = null;
  state.mySeats = new Set();
  state.holdTotal = null;
  sessionStorage.removeItem(holdKey());
}

function applyHold(hold) {
  if (!hold || !hold.seat_ids || !hold.seat_ids.length) {
    stopTimer();
    clearLocalHold();
    return;
  }
  state.bookingId = hold.booking_id;
  state.mySeats = new Set(hold.seat_ids);
  state.holdTotal = hold.total_price;
  sessionStorage.setItem(holdKey(), String(hold.booking_id));
  // Mỗi lần thêm ghế vào cùng phiên thì dùng chung 1 đồng hồ theo server
  startTimer(hold.hold_seconds_left != null ? hold.hold_seconds_left : HOLD_TOTAL_SECONDS);
}

async function restoreHold() {
  const saved = sessionStorage.getItem(holdKey());
  if (!saved) return;
  try {
    applyHold(await api(`/holds/${saved}?user_id=${encodeURIComponent(state.userId)}`));
  } catch (e) {
    clearLocalHold(); // phiên cũ đã hết hạn hoặc không còn
  }
}

async function onSeatClick(seat) {
  if (state.busy) return;
  const mine = state.mySeats.has(seat.seat_id);
  if (!mine && state.mySeats.size >= MAX_SEATS) {
    showToast(`Bạn chỉ được chọn tối đa ${MAX_SEATS} ghế một lần`);
    return;
  }
  state.busy = true;
  try {
    if (mine) {
      applyHold(
        await api(
          `/holds/${state.bookingId}/seats/${seat.seat_id}?user_id=${encodeURIComponent(state.userId)}`,
          { method: "DELETE" }
        )
      );
    } else {
      applyHold(
        await api(`/trips/${state.tripId}/holds`, {
          method: "POST",
          body: JSON.stringify({
            user_id: state.userId,
            seat_ids: [seat.seat_id],
            booking_id: state.bookingId,
          }),
        })
      );
    }
  } catch (error) {
    showToast(error.message);
    if (error.status === 409 || error.status === 404) {
      // Ghế vừa bị người khác lấy hoặc phiên đã hết hạn
      if (state.bookingId) await restoreHold();
      if (!state.mySeats.size) { stopTimer(); clearLocalHold(); }
    }
  } finally {
    state.busy = false;
    await loadMap();
  }
}

async function clearAll() {
  if (state.busy || !state.bookingId) return;
  state.busy = true;
  try {
    await api(`/holds/${state.bookingId}?user_id=${encodeURIComponent(state.userId)}`, { method: "DELETE" });
  } catch (error) {
    showToast(error.message);
  } finally {
    stopTimer();
    clearLocalHold();
    state.busy = false;
    await loadMap();
  }
}

// ====== TẢI SƠ ĐỒ ======
async function loadMap() {
  try {
    state.map = await api(`/trips/${state.tripId}/seats`);
    render();
  } catch (error) {
    $("seatMap").innerHTML = "";
    const box = document.createElement("div");
    box.className = "bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-rose-600";
    box.textContent = error.message;
    $("seatMap").appendChild(box);
  }
}

// ====== KHỞI ĐỘNG ======
async function init() {
  if (!state.tripId) {
    $("seatMap").innerHTML = "";
    const box = document.createElement("div");
    box.className = "bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-rose-600";
    box.textContent = "Thiếu mã chuyến. Hãy mở trang này từ trang chi tiết chuyến.";
    $("seatMap").appendChild(box);
    return;
  }
  $("backLink").href = `trip-detail.html?trip_id=${state.tripId}`;
  $("clearBtn").addEventListener("click", clearAll);
  $("expiredOk").addEventListener("click", () => {
    $("expiredModal").classList.add("hidden");
    $("expiredModal").classList.remove("flex");
  });

  await loadMap();
  await restoreHold(); // tải lại trang vẫn giữ được ghế đã chọn và đồng hồ
  render();

  setInterval(() => { if (!state.busy) loadMap(); }, REFRESH_MS);
}

init();