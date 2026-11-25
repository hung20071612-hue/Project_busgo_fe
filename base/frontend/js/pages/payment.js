const HOLD_TOTAL_SECONDS = 10 * 60;
const bookingId = Number(new URLSearchParams(window.location.search).get("booking_id"));

const state = {
  userId: null,
  booking: null,
  method: null,
  endsAt: null,
  timerId: null,
  busy: false,
};

const METHOD_LABEL = {
  CASH: "Tiền mặt",
  TRANSFER: "Chuyển khoản VietQR",
  WALLET: "Ví điện tử",
};

function showError(message) {
  document.getElementById("payView").hidden = true;
  document.getElementById("doneView").hidden = true;
  document.getElementById("errorText").textContent = message;
  document.getElementById("errorBox").hidden = false;
}

function renderPassengerList(ulEl, passengers) {
  ulEl.innerHTML = (passengers || [])
    .map(
      (p) =>
        `<li style="margin-bottom:4px;"><span class="seat-chip">${escapeHtml(p.seat_code)}</span> <strong>${escapeHtml(
          p.passenger_name || "-"
        )}</strong> · ${escapeHtml(p.passenger_phone || "-")}</li>`
    )
    .join("");
}

function startTimer(seconds) {
  state.endsAt = Date.now() + seconds * 1000;
  document.getElementById("timerCard").hidden = false;
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    const left = Math.ceil((state.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(state.timerId);
      showError("Đơn đặt vé đã hết hạn giữ ghế 10 phút. Vui lòng đặt lại chuyến.");
      return;
    }
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    document.getElementById("timerText").textContent = `${m}:${s}`;
    document.getElementById("timerBar").style.width = `${Math.max(0, Math.min(100, (left / HOLD_TOTAL_SECONDS) * 100))}%`;
  }, 1000);
}

function renderPayView(b) {
  document.getElementById("sumCode").textContent = b.booking_code;
  document.getElementById("sumRoute").textContent =
    b.from_station && b.to_station ? `${b.from_station} → ${b.to_station}` : `Chuyến #${b.trip_id}`;
  document.getElementById("sumDeparture").textContent = b.departure_time ? formatDateTime(b.departure_time) : "—";
  document.getElementById("sumPickup").textContent = b.pickup || "—";
  document.getElementById("sumDropoff").textContent = b.dropoff || "—";
  document.getElementById("sumTotal").textContent = formatMoney(b.total_price);
  renderPassengerList(document.getElementById("sumPassengers"), b.passengers);

  document.getElementById("payView").hidden = false;
  document.getElementById("doneView").hidden = true;

  if (b.hold_seconds_left != null && b.hold_seconds_left > 0) {
    startTimer(b.hold_seconds_left);
  }
}

function renderDoneView(b) {
  clearInterval(state.timerId);
  document.getElementById("payView").hidden = true;
  document.getElementById("doneView").hidden = false;

  const stepPay = document.getElementById("stepPay");
  const stepDone = document.getElementById("stepDone");
  stepPay.className = "step-item done";
  stepPay.querySelector(".step-num").textContent = "✓";
  stepDone.className = "step-item active";

  document.getElementById("ticketCode").textContent = b.booking_code;
  document.getElementById("ticketRoute").textContent =
    b.from_station && b.to_station ? `${b.from_station} → ${b.to_station}` : `Chuyến #${b.trip_id}`;
  document.getElementById("ticketDeparture").textContent = b.departure_time ? formatDateTime(b.departure_time) : "—";
  document.getElementById("ticketStops").textContent = `${b.pickup || "—"} → ${b.dropoff || "—"}`;
  document.getElementById("ticketMethod").textContent = METHOD_LABEL[b.payment_method] || b.payment_method || "Đã thanh toán";
  document.getElementById("ticketTotal").textContent = formatMoney(b.total_price);
  renderPassengerList(document.getElementById("ticketPassengers"), b.passengers);

  const qrBox = document.getElementById("qrBox");
  qrBox.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrBox, {
      text: `BUSGO|${b.booking_code}|TRIP:${b.trip_id}`,
      width: 140,
      height: 140,
    });
  }
}

document.querySelectorAll(".pay-method-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".pay-method-card").forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    card.querySelector("input").checked = true;
    state.method = card.dataset.method;
    document.getElementById("payBtn").disabled = false;
  });
});

document.getElementById("payBtn").addEventListener("click", async () => {
  if (!state.method || state.busy) return;
  state.busy = true;
  const btn = document.getElementById("payBtn");
  btn.disabled = true;
  btn.textContent = "Đang xử lý thanh toán...";

  try {
    await api.post("/payments", {
      user_id: state.userId,
      booking_id: bookingId,
      method: state.method,
    });
    showToast("Thanh toán thành công! Vé điện tử đã sẵn sàng.");
    const updated = await api.get(`/bookings/${bookingId}/checkout`, { user_id: state.userId });
    state.booking = updated;
    renderDoneView(updated);
  } catch (error) {
    showToast(error.message || "Thanh toán thất bại.", "error");
    btn.disabled = false;
    btn.textContent = "Xác nhận thanh toán →";
  } finally {
    state.busy = false;
  }
});

(async function initPayment() {
  if (!bookingId) {
    showError("Thiếu mã đơn đặt vé (booking_id).");
    return;
  }

  state.userId = await requireAuthenticatedUserId();
  if (!state.userId) return;

  try {
    const b = await api.get(`/bookings/${bookingId}/checkout`, { user_id: state.userId });
    state.booking = b;
    if (b.status === "PAID") {
      renderDoneView(b);
    } else if (b.status === "CANCELLED") {
      showError("Đơn đặt vé này đã bị hủy.");
    } else {
      renderPayView(b);
    }
  } catch (error) {
    showError(error.message || "Không tìm thấy đơn đặt vé.");
  }
})();