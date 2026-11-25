(() => {
  function formatVND(amount) {
    return Number(amount || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatDateTimeVN(isoStr) {
    if (!isoStr) return "Đang cập nhật";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function escapeText(str) {
    return String(str ?? "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "'");
  }

  function getStatusMeta(status) {
    const st = String(status || "").toUpperCase();
    if (st === "PAID" || st === "CONFIRMED") {
      return {
        label: "Đã thanh toán",
        style: "background: var(--color-success-bg); color: var(--color-success);",
      };
    }
    if (st === "PENDING_PAYMENT" || st === "PENDING") {
      return {
        label: "Chờ thanh toán",
        style: "background: var(--color-warning-bg); color: var(--color-warning);",
      };
    }
    return {
      label: st === "CANCELLED" ? "Đã hủy" : st || "Không xác định",
      style: "background: var(--color-danger-bg); color: var(--color-danger);",
    };
  }

  async function performLookup(rawCode, rawPhone) {
    const errorEl = document.getElementById("lookup-error");
    const errorMsgEl = document.getElementById("lookup-error-msg");
    const resultEl = document.getElementById("lookup-result");
    const submitBtn = document.getElementById("btn-lookup-submit");

    const code = rawCode.trim().replace(/^#/, "");
    const phone = rawPhone.trim();

    errorEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang tra cứu...";

    try {
      const data = await api.get("/bookings/lookup", { code, phone });

      const bookingId = data.booking_id ?? data.id;
      const displayCode = data.booking_code || `BG${String(bookingId).padStart(4, "0")}`;
      const meta = getStatusMeta(data.status);

      document.getElementById("res-code").textContent = `#${displayCode}`;

      const statusEl = document.getElementById("res-status");
      statusEl.textContent = meta.label;
      statusEl.setAttribute("style", meta.style);

      document.getElementById("res-total").textContent = formatVND(
        data.total_price ?? data.total_amount ?? 0
      );
      document.getElementById("res-origin").textContent =
        data.from_station || data.origin || "Điểm đi";
      document.getElementById("res-destination").textContent =
        data.to_station || data.destination || "Điểm đến";
      document.getElementById("res-departure").textContent = formatDateTimeVN(
        data.departure_at || data.departure_time
      );
      document.getElementById("res-pickup").textContent =
        data.pickup || data.pickup_point || "Tại bến xe đi";
      document.getElementById("res-dropoff").textContent =
        data.dropoff || data.dropoff_point || "Tại bến xe đến";

      const passengers = Array.isArray(data.passengers) ? data.passengers : [];
      const seats = passengers
        .map((p) => p.seat_code || p.seat_number || p.seat_id)
        .filter(Boolean);

      document.getElementById("res-seats").textContent =
        seats.length > 0 ? seats.join(", ") : "Đang cập nhật";

      const tbody = document.getElementById("res-passengers-body");
      tbody.innerHTML =
        passengers.length > 0
          ? passengers
              .map(
                (p) => `
                <tr>
                  <td><strong>${escapeText(p.seat_code || p.seat_id)}</strong></td>
                  <td>${escapeText(p.passenger_name || "Hành khách")}</td>
                  <td>${escapeText(p.passenger_phone || phone)}</td>
                </tr>`
              )
              .join("")
          : `<tr><td colspan="3" class="muted">Chưa có chi tiết hành khách</td></tr>`;

      document.getElementById("res-detail-link").href = `booking-detail.html?id=${bookingId}`;

      const qrEl = document.getElementById("lookup-qr");
      qrEl.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        new QRCode(qrEl, {
          text: `BUSGO:${displayCode}`,
          width: 128,
          height: 128,
          colorDark: "#0F172A",
          colorLight: "#FFFFFF",
        });
      }

      resultEl.classList.remove("hidden");
    } catch (err) {
      errorMsgEl.textContent =
        err.message || "Không tìm thấy vé khớp với mã vé và số điện thoại đã nhập.";
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Tra cứu vé";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lookup-form");
    const codeInput = document.getElementById("lookup-code");
    const phoneInput = document.getElementById("lookup-phone");

    // Tự động điền SĐT nếu người dùng đang đăng nhập
    try {
      const user = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || "null");
      if (user?.phone && !phoneInput.value) {
        phoneInput.value = user.phone;
      }
    } catch (_) {}

    // Hỗ trợ mở thẳng từ link ?code=...&phone=... hoặc ?booking_id=...&phone=...
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get("code") || params.get("booking_code") || params.get("booking_id") || params.get("id");
    const qPhone = params.get("phone");
    if (qCode && qPhone) {
      codeInput.value = qCode;
      phoneInput.value = qPhone;
      performLookup(qCode, qPhone);
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!codeInput.value.trim() || !phoneInput.value.trim()) return;
      performLookup(codeInput.value, phoneInput.value);
    });
  });
})();