(() => {
  let allBookings = [];
  let currentStatus = "ALL";
  let searchKeyword = "";
  const tripCache = new Map();

  function safeHtml(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  function formatVND(amount) {
    if (typeof formatMoney === "function") return formatMoney(amount);
    return Number(amount || 0).toLocaleString("vi-VN") + " ₫";
  }

  function formatDateTimeVN(isoStr) {
    if (!isoStr) return "Đang cập nhật";
    if (typeof formatDateTime === "function") {
      const d = new Date(isoStr);
      if (!Number.isNaN(d.getTime())) return formatDateTime(isoStr);
    }
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return (
      d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
      " " +
      d.toLocaleDateString("vi-VN")
    );
  }

  function getStatusMeta(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PAID" || normalized === "CONFIRMED") {
      return {
        key: "PAID",
        label: "Đã thanh toán",
        badgeClass: "badge-status badge-paid",
      };
    }
    if (normalized === "PENDING_PAYMENT" || normalized === "PENDING") {
      return {
        key: "PENDING_PAYMENT",
        label: "Chờ thanh toán",
        badgeClass: "badge-status badge-pending",
      };
    }
    if (normalized === "CANCELLED") {
      return {
        key: "CANCELLED",
        label: "Đã hủy",
        badgeClass: "badge-status badge-cancelled",
      };
    }
    return {
      key: normalized,
      label: normalized || "Không xác định",
      badgeClass: "badge-status",
    };
  }

  async function fetchTripInfo(tripId) {
    if (!tripId) return null;
    if (tripCache.has(tripId)) return tripCache.get(tripId);
    try {
      const trip = await api.get(`/trips/${tripId}`);
      tripCache.set(tripId, trip);
      return trip;
    } catch {
      tripCache.set(tripId, null);
      return null;
    }
  }

  function updateTabCounts() {
    const counts = { ALL: allBookings.length, PAID: 0, PENDING_PAYMENT: 0, CANCELLED: 0 };
    allBookings.forEach((b) => {
      const meta = getStatusMeta(b.status);
      if (counts[meta.key] !== undefined) counts[meta.key] += 1;
    });

    Object.entries(counts).forEach(([key, val]) => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = val;
    });
  }

  function renderBookings() {
    const listEl = document.getElementById("bookings-list");
    const emptyEl = document.getElementById("bookings-empty");

    const filtered = allBookings.filter((b) => {
      const meta = getStatusMeta(b.status);
      const matchStatus = currentStatus === "ALL" || meta.key === currentStatus;
      if (!matchStatus) return false;

      if (!searchKeyword) return true;
      const kw = searchKeyword.toLowerCase();
      const code = String(b.booking_code || `BG${String(b.id).padStart(4, "0")}`).toLowerCase();
      const origin = String(b.trip?.origin || b.origin || "").toLowerCase();
      const dest = String(b.trip?.destination || b.destination || "").toLowerCase();
      return code.includes(kw) || origin.includes(kw) || dest.includes(kw);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = filtered
      .map((b) => {
        const meta = getStatusMeta(b.status);
        const trip = b.trip || {};
        const bookingCode = safeHtml(b.booking_code || `BG${String(b.id).padStart(4, "0")}`);
        const origin = safeHtml(trip.origin || b.origin || "Điểm khởi hành");
        const destination = safeHtml(trip.destination || b.destination || "Điểm đến");
        const departureTime = safeHtml(formatDateTimeVN(trip.departure_time || b.departure_time));
        const createdTime = safeHtml(formatDateTimeVN(b.created_at));
        const busType = safeHtml(trip.bus_type_name || trip.bus_type || "Xe khách tiêu chuẩn");
        const totalAmount = safeHtml(formatVND(b.total_amount ?? b.total_price ?? 0));

        const details = b.details || b.passengers || [];
        const seats =
          details.length > 0
            ? details.map((d) => d.seat_number || d.seat_code || d.seat_id).filter(Boolean)
            : b.seats || [];

        const seatChipsHtml =
          seats.length > 0
            ? seats.map((s) => `<span class="seat-chip">${safeHtml(s)}</span>`).join("")
            : `<span class="seat-chip">${safeHtml(b.seat_count || 1)} ghế</span>`;

        const payNowBtn =
          meta.key === "PENDING_PAYMENT"
            ? `<a href="payment.html?booking_id=${encodeURIComponent(b.id)}" class="btn btn-accent btn-small">Thanh toán ngay</a>`
            : "";

        return `
          <article class="card booking-card">
            <div class="booking-card-top">
              <div class="booking-code-group">
                <span class="booking-code-pill">#${bookingCode}</span>
                <span class="muted" style="font-size: 13px;">Đặt lúc: ${createdTime}</span>
              </div>
              <span class="${meta.badgeClass}">${safeHtml(meta.label)}</span>
            </div>

            <div class="booking-card-body">
              <div>
                <div class="booking-route-title">
                  <span>${origin}</span>
                  <span class="booking-route-arrow">→</span>
                  <span>${destination}</span>
                </div>
                <div class="booking-meta-list">
                  <span>Khởi hành: <strong>${departureTime}</strong></span>
                  <span>Loại xe: <strong>${busType}</strong></span>
                </div>
              </div>

              <div>
                <div class="booking-field-label">Vị trí ghế</div>
                <div>${seatChipsHtml}</div>
              </div>

              <div class="booking-total-box">
                <div class="booking-field-label">Tổng thanh toán</div>
                <div class="booking-total-price">${totalAmount}</div>
              </div>
            </div>

            <div class="booking-card-footer">
              ${payNowBtn}
              <a href="booking-detail.html?id=${encodeURIComponent(b.id)}" class="btn btn-primary btn-small">
                Xem chi tiết / Mã QR
              </a>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function setupEvents() {
    document.querySelectorAll(".booking-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentStatus = btn.dataset.status;
        document.querySelectorAll(".booking-tab-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderBookings();
      });
    });

    const searchInput = document.getElementById("search-booking-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchKeyword = e.target.value.trim();
        renderBookings();
      });
    }
  }

  async function init() {
    if (typeof Auth !== "undefined" && !Auth.requireAuth()) return;

    setupEvents();

    const loadingEl = document.getElementById("bookings-loading");
    const errorEl = document.getElementById("bookings-error");

    try {
      let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
      if ((!user || !(user.id || user.user_id)) && typeof Auth !== "undefined") {
        user = await Auth.fetchCurrentUser();
      }

      const userId = user?.id || user?.user_id || localStorage.getItem("user_id");
      if (!userId) {
        loadingEl.hidden = true;
        errorEl.hidden = false;
        errorEl.textContent = "Không xác định được tài khoản hiện tại. Vui lòng đăng nhập lại.";
        return;
      }

      const data = await api.get("/bookings", { user_id: userId });
      const rawList = Array.isArray(data) ? data : data.bookings || data.items || [];

      allBookings = await Promise.all(
        rawList.map(async (booking) => {
          if (!booking.trip && booking.trip_id) {
            booking.trip = await fetchTripInfo(booking.trip_id);
          }
          return booking;
        })
      );

      allBookings.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      loadingEl.hidden = true;
      updateTabCounts();
      renderBookings();
    } catch (err) {
      loadingEl.hidden = true;
      errorEl.hidden = false;
      errorEl.textContent = err.message || "Đã xảy ra lỗi khi tải danh sách vé.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();