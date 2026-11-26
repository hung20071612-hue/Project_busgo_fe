const HOLD_TOTAL_SECONDS = 10 * 60;
const params = new URLSearchParams(window.location.search);
const bookingId = Number(params.get("booking_id"));
const tripIdParam = Number(params.get("trip_id"));

let userId = null;
let holdData = null;
let seatCodeMap = {};
let endsAt = null;
let timerId = null;

function startTimer(secondsLeft) {
  endsAt = Date.now() + secondsLeft * 1000;
  document.getElementById("timerCard").hidden = false;
  clearInterval(timerId);
  timerId = setInterval(() => {
    const left = Math.ceil((endsAt - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(timerId);
      showToast("Đã hết thời gian giữ ghế, vui lòng chọn lại ghế.", "error");
      window.location.href = `seat-selection.html?trip_id=${encodeURIComponent(holdData?.trip_id || tripIdParam)}`;
      return;
    }
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    document.getElementById("timerText").textContent = `${m}:${s}`;
    document.getElementById("timerBar").style.width = `${Math.max(0, Math.min(100, (left / HOLD_TOTAL_SECONDS) * 100))}%`;
  }, 1000);
}

function renderPassengerInputs(seatIds) {
  const currentUser = typeof Auth !== "undefined" ? Auth.getUser() : null;
  const defaultName = currentUser?.full_name || "";
  const defaultPhone = currentUser?.phone || "";

  const container = document.getElementById("passenger-fields");
  container.innerHTML = seatIds
    .map((seatId, idx) => {
      const code = seatCodeMap[seatId] || `Ghế #${seatId}`;
      return `
        <div class="card" style="background:#f8fafc; margin-bottom:12px; padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <strong>Hành khách ${idx + 1}</strong>
            <span class="seat-chip">Mã ghế: ${escapeHtml(code)}</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label for="pname-${seatId}">Họ và tên hành khách *</label>
              <input id="pname-${seatId}" data-seat-name="${seatId}" type="text" required maxlength="100"
                     value="${idx === 0 ? escapeHtml(defaultName) : ""}" placeholder="VD: Nguyễn Văn A">
            </div>
            <div>
              <label for="pphone-${seatId}">Số điện thoại *</label>
              <input id="pphone-${seatId}" data-seat-phone="${seatId}" type="tel" required maxlength="15"
                     value="${idx === 0 ? escapeHtml(defaultPhone) : ""}" placeholder="VD: 0912345678">
            </div>
          </div>
        </div>`;
    })
    .join("");
}

document.getElementById("btn-copy-phone").addEventListener("click", () => {
  const phoneInputs = document.querySelectorAll("input[data-seat-phone]");
  if (phoneInputs.length <= 1) return;
  const firstPhone = phoneInputs[0].value.trim();
  if (!firstPhone) {
    showToast("Vui lòng nhập số điện thoại ở hành khách 1 trước.", "error");
    return;
  }
  phoneInputs.forEach((inp, idx) => {
    if (idx > 0) inp.value = firstPhone;
  });
  showToast("Đã áp dụng số điện thoại cho toàn bộ hành khách.");
});

document.getElementById("passenger-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("form-error");
  errEl.hidden = true;

  const pickup = document.getElementById("pickup").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const phoneRegex = /^\+?\d{9,14}$/;

  const passengers = [];
  for (const seatId of holdData.seat_ids) {
    const name = document.querySelector(`input[data-seat-name="${seatId}"]`).value.trim();
    const phone = document.querySelector(`input[data-seat-phone="${seatId}"]`).value.trim();
    if (!name) {
      errEl.textContent = "Vui lòng nhập đầy đủ họ tên cho tất cả ghế.";
      errEl.hidden = false;
      return;
    }
    if (!phoneRegex.test(phone)) {
      errEl.textContent = `Số điện thoại "${phone}" không hợp lệ (cần 9–14 chữ số).`;
      errEl.hidden = false;
      return;
    }
    passengers.push({
      seat_id: Number(seatId),
      passenger_name: name,
      passenger_phone: phone,
    });
  }

  const submitBtn = document.getElementById("btn-submit-booking");
  submitBtn.disabled = true;
  try {
    const created = await api.post("/bookings", {
      user_id: userId,
      booking_id: bookingId,
      pickup,
      dropoff,
      passengers,
    });
    sessionStorage.removeItem(`busgo_hold_${holdData.trip_id}`);
    window.location.href = `payment.html?booking_id=${encodeURIComponent(created.booking_id)}`;
  } catch (error) {
    errEl.textContent = error.message || "Không thể tạo đơn đặt vé.";
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

(async function initPassengerInfo() {
  if (!bookingId) {
    showToast("Thiếu thông tin phiên giữ ghế.", "error");
    window.location.href = "trips.html";
    return;
  }

  userId = await requireAuthenticatedUserId();
  if (!userId) return;

  try {
    holdData = await api.get(`/holds/${bookingId}`, { user_id: userId });
    if (!holdData || !holdData.seat_ids || holdData.seat_ids.length === 0 || holdData.hold_seconds_left <= 0) {
      showToast("Phiên giữ ghế đã hết hạn, vui lòng chọn lại ghế.", "error");
      window.location.href = `seat-selection.html?trip_id=${encodeURIComponent(tripIdParam || holdData?.trip_id || "")}`;
      return;
    }

    const tripId = holdData.trip_id;
    document.getElementById("crumb-seat").href = `seat-selection.html?trip_id=${encodeURIComponent(tripId)}`;
    document.getElementById("btn-back-seat").href = `seat-selection.html?trip_id=${encodeURIComponent(tripId)}`;

    const [seatMapRes, tripDetail] = await Promise.all([
      api.get(`/trips/${tripId}/seats`),
      api.get(`/trips/${tripId}/details`).catch(() => null),
    ]);

    (seatMapRes?.seats || []).forEach((s) => {
      seatCodeMap[s.seat_id] = s.seat_code;
    });

    if (tripDetail) {
      document.getElementById("sumRoute").textContent = `${tripDetail.origin_station} → ${tripDetail.dest_station}`;
      document.getElementById("sumDeparture").textContent = formatDateTime(tripDetail.departure_at);
      document.getElementById("pickup").value = tripDetail.origin_station || "";
      document.getElementById("dropoff").value = tripDetail.dest_station || "";
    }

    document.getElementById("sumBookingCode").textContent = holdData.booking_code;
    document.getElementById("sumSeatCount").textContent = `${holdData.seat_ids.length} ghế`;
    document.getElementById("sumTotal").textContent = formatMoney(holdData.total_price);

    startTimer(holdData.hold_seconds_left);
    renderPassengerInputs(holdData.seat_ids);
  } catch (error) {
    showToast(error.message || "Không tải được phiên giữ ghế.", "error");
    window.location.href = "trips.html";
  }
})();