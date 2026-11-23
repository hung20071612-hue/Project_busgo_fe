/* Trang thanh toán và xác nhận đặt vé.
 *
 * Mở trang:  payment.html?booking_id=1
 * API dùng:
 *   GET  /api/bookings/{booking_id}?user_id=...   xem đơn (tóm tắt, vé sau khi thanh toán)
 *   POST /api/payments                            xác nhận thanh toán giả lập
 * Đơn PENDING_PAYMENT -> hiện form chọn phương thức; PAID -> hiện vé + mã QR.
 */

// ====== CẤU HÌNH (sửa cho khớp project) ======
const API_BASE = window.API_BASE_URL || "http://127.0.0.1:8000/api";

// TẠM: chưa có đăng nhập nên lấy user_id từ ?user_id=..., localStorage, hoặc user test.
// Khi có JWT thì bỏ hàm này và gửi token qua header Authorization.
function getUserId() {
  const params = new URLSearchParams(location.search);
  return params.get("user_id") || localStorage.getItem("user_id") || "U0001";
}

const state = {
  bookingId: Number(new URLSearchParams(location.search).get("booking_id")),
  userId: getUserId(),
  booking: null,
  method: null,
  endsAt: null,
  timerId: null,
  busy: false,
};

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(Number(n) || 0)) + " đ";
const fmtDate = (v) =>
  v ? new Date(v).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
const METHOD_LABEL = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", WALLET: "Ví điện tử" };

// ====== GỌI API ======
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, { headers: { "Content-Type": "application/json" }, ...options });
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

let toastTimer = null;
function showToast(message) {
  const el = $("toast");
  el.textContent = message; // textContent: không chèn HTML, tránh XSS
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
}

function showError(message, linkHref, linkText) {
  $("payView").classList.add("hidden");
  $("doneView").classList.add("hidden");
  $("errorText").textContent = message;
  if (linkHref) {
    $("errorLink").href = linkHref;
    $("errorLink").textContent = linkText;
  }
  $("errorBox").classList.remove("hidden");
}

// ====== HIỂN THỊ DANH SÁCH HÀNH KHÁCH ======
function fillPassengers(listEl, passengers) {
  listEl.innerHTML = "";
  passengers.forEach((p) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2";
    const badge = document.createElement("span");
    badge.className = "px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold";
    badge.textContent = p.seat_code;
    const text = document.createElement("span");
    text.className = "text-slate-700";
    text.textContent = `${p.passenger_name || "-"} · ${p.passenger_phone || "-"}`;
    li.append(badge, text);
    listEl.appendChild(li);
  });
}

// ====== BƯỚC 3: THANH TOÁN ======
function renderPay(b) {
  $("sumCode").textContent = b.booking_code;
  $("sumRoute").textContent = b.from_station && b.to_station ? `${b.from_station} → ${b.to_station}` : `Chuyến #${b.trip_id}`;
  $("sumDeparture").textContent = fmtDate(b.departure_time);
  $("sumPickup").textContent = b.pickup || "-";
  $("sumDropoff").textContent = b.dropoff || "-";
  $("sumTotal").textContent = money(b.total_price);
  fillPassengers($("sumPassengers"), b.passengers);
  $("backLink").href = `seat-selection.html?trip_id=${b.trip_id}`;
  $("expiredLink").href = `seat-selection.html?trip_id=${b.trip_id}`;

  $("payView").classList.remove("hidden");
  $("doneView").classList.add("hidden");
  if (b.hold_seconds_left != null) startTimer(b.hold_seconds_left);
}

// Đồng hồ đếm ngược thời gian còn thanh toán (lấy số giây từ server)
function startTimer(seconds) {
  state.endsAt = Date.now() + seconds * 1000;
  $("timerCard").classList.remove("hidden");
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
  tick();
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
  $("timerCard").classList.add("hidden");
}

function tick() {
  const left = Math.ceil((state.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    stopTimer();
    $("expiredModal").classList.remove("hidden");
    $("expiredModal").classList.add("flex");
    $("payBtn").disabled = true;
    return;
  }
  $("timerText").textContent =
    `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const urgent = left <= 60;
  $("timerCard").className = `rounded-xl border p-4 ${urgent ? "border-rose-200 bg-rose-50" : "border-orange-200 bg-orange-50"}`;
  $("timerText").className = `font-headline text-2xl font-extrabold tabular-nums ${urgent ? "text-rose-600" : "text-orange-600"}`;
}

function onMethodChange() {
  const checked = document.querySelector('input[name="method"]:checked');
  state.method = checked ? checked.value : null;
  document.querySelectorAll("[data-check]").forEach((icon) => icon.classList.add("opacity-0"));
  if (checked) checked.closest("label").querySelector("[data-check]").classList.remove("opacity-0");
  $("payBtn").disabled = !state.method || state.busy;
}

async function onPay() {
  if (!state.method || state.busy) return;
  state.busy = true;
  $("payBtn").disabled = true;
  $("payBtn").textContent = "Đang xử lý...";
  try {
    await api("/payments", {
      method: "POST",
      body: JSON.stringify({ user_id: state.userId, booking_id: state.bookingId, method: state.method }),
    });
    stopTimer();
    state.booking = await api(`/bookings/${state.bookingId}?user_id=${encodeURIComponent(state.userId)}`);
    renderDone(state.booking);
  } catch (error) {
    showToast(error.message);
    $("payBtn").textContent = "Xác nhận thanh toán";
    state.busy = false;
    if (error.status === 409) {
      // Đơn đã thanh toán / bị hủy / hết hạn: tải lại trạng thái thật từ server
      await load();
    } else {
      $("payBtn").disabled = !state.method;
    }
    return;
  }
  state.busy = false;
}

// ====== BƯỚC 4: XÁC NHẬN, HIỂN THỊ VÉ + QR ======
function renderDone(b) {
  $("tkCode").textContent = b.booking_code;
  $("tkFrom").textContent = b.from_station || `Chuyến #${b.trip_id}`;
  $("tkTo").textContent = b.to_station || "-";
  $("tkDeparture").textContent = fmtDate(b.departure_time);
  $("tkMethod").textContent = METHOD_LABEL[b.payment_method] || "-";
  $("tkPickup").textContent = b.pickup || "-";
  $("tkDropoff").textContent = b.dropoff || "-";
  $("tkTotal").textContent = money(b.total_price);
  fillPassengers($("tkPassengers"), b.passengers);

  // Mã QR chứa mã vé để nhân viên quét
  const qrBox = $("qrBox");
  qrBox.innerHTML = "";
  if (window.QRCode) {
    new QRCode(qrBox, { text: b.booking_code, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M });
  } else {
    qrBox.textContent = b.booking_code; // thư viện QR không tải được thì hiện mã chữ
  }

  // Thanh bước: bước 3 xong, bước 4 đang ở
  $("stepPay").className = "flex items-center gap-2 text-emerald-600";
  $("stepPay").firstElementChild.className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center material-symbols-outlined text-[16px]";
  $("stepPay").firstElementChild.textContent = "check";
  $("stepDone").className = "flex items-center gap-2 text-orange-600";
  $("stepDone").firstElementChild.className = "w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[12px]";

  $("payView").classList.add("hidden");
  $("errorBox").classList.add("hidden");
  $("doneView").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ====== TẢI ĐƠN VÀ CHỌN MÀN HÌNH PHÙ HỢP ======
async function load() {
  try {
    const b = await api(`/bookings/${state.bookingId}?user_id=${encodeURIComponent(state.userId)}`);
    state.booking = b;
    if (b.status === "PAID") {
      renderDone(b);
    } else if (b.status === "CANCELLED") {
      showError("Đơn đặt vé này đã bị hủy.", "../index.html", "Về trang chủ");
    } else if (!b.passengers.length || b.passengers.some((p) => !p.passenger_name || !b.pickup || !b.dropoff)) {
      // Chưa nhập hành khách / điểm đón trả
      showError(
        "Bạn chưa nhập thông tin hành khách và điểm đón/trả cho đơn này.",
        `passenger-info.html?trip_id=${b.trip_id}&booking_id=${b.booking_id}`,
        "Nhập thông tin hành khách"
      );
    } else {
      renderPay(b);
      $("payBtn").textContent = "Xác nhận thanh toán";
      $("payBtn").disabled = !state.method;
    }
  } catch (error) {
    if (error.status === 404) showError("Không tìm thấy đơn đặt vé, hoặc đơn đã hết hạn giữ ghế.", "../index.html", "Về trang chủ");
    else showError(error.message, "../index.html", "Về trang chủ");
  }
}

function init() {
  if (!state.bookingId) {
    showError("Thiếu mã đơn đặt vé. Hãy mở trang này sau bước nhập thông tin hành khách.", "../index.html", "Về trang chủ");
    return;
  }
  document.querySelectorAll('input[name="method"]').forEach((el) => el.addEventListener("change", onMethodChange));
  $("payBtn").addEventListener("click", onPay);
  $("printBtn").addEventListener("click", () => window.print());
  load();
}

init();