(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

  let currentBooking = null;
  let currentTrip = null;
  let currentDetails = [];

  function formatVND(amount) {
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  }

  function formatDateTimeVN(isoStr) {
    if (!isoStr) return 'Đang cập nhật';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getUserId() {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      return u?.id || u?.user_id || localStorage.getItem('user_id') || null;
    } catch (_) {
      return localStorage.getItem('user_id') || null;
    }
  }

  async function fetchJson(url, options = {}) {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  function getStatusMeta(status) {
    const st = String(status || '').toUpperCase();
    if (st === 'PAID' || st === 'CONFIRMED') {
      return {
        label: 'Đã thanh toán',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        canCancel: true,
      };
    }
    if (st === 'PENDING_PAYMENT' || st === 'PENDING') {
      return {
        label: 'Chờ thanh toán',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        canCancel: true,
      };
    }
    return {
      label: st === 'CANCELLED' ? 'Đã hủy' : st,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      canCancel: false,
    };
  }

  function calculateRefundPreview() {
    const total = Number(currentBooking?.total_amount ?? currentBooking?.total_price ?? 0);
    const st = String(currentBooking?.status || '').toUpperCase();
    if (st !== 'PAID' && st !== 'CONFIRMED') {
      return { hoursLeft: null, refundAmount: 0, isEligible100: false, unpaid: true };
    }

    const depStr = currentTrip?.departure_time || currentBooking?.departure_time;
    if (!depStr) {
      return { hoursLeft: 24, refundAmount: total, isEligible100: true, unpaid: false };
    }

    const depTime = new Date(depStr).getTime();
    const hoursLeft = (depTime - Date.now()) / (1000 * 60 * 60);
    const isEligible100 = hoursLeft >= 24;
    return {
      hoursLeft,
      refundAmount: isEligible100 ? total : 0,
      isEligible100,
      unpaid: false,
    };
  }

  function renderQRCode(bookingCode) {
    const qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: `BUSGO:${bookingCode}`,
        width: 140,
        height: 140,
        colorDark: '#0F172A',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } else {
      qrContainer.textContent = bookingCode;
    }
  }

  function renderDetail() {
    const b = currentBooking;
    const t = currentTrip || {};
    const bookingCode = b.booking_code || `BG${String(b.id).padStart(4, '0')}`;
    const meta = getStatusMeta(b.status);

    document.getElementById('bp-code').textContent = `#${bookingCode}`;
    const statusBadge = document.getElementById('bp-status-badge');
    statusBadge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${meta.badgeClass}`;
    statusBadge.textContent = meta.label;

    document.getElementById('bp-bus-type').textContent = t.bus_type_name || t.bus_type || 'Xe giường nằm / Ghế ngồi';
    document.getElementById('bp-origin').textContent = t.origin || b.origin || 'Điểm đi';
    document.getElementById('bp-destination').textContent = t.destination || b.destination || 'Điểm đến';
    document.getElementById('bp-departure').textContent = formatDateTimeVN(t.departure_time || b.departure_time);
    document.getElementById('bp-plate').textContent = t.license_plate || t.bus_plate || 'Đang điều phối';
    document.getElementById('bp-pickup').textContent = b.pickup_point || t.pickup_point || `Bến xe ${t.origin || ''}`;
    document.getElementById('bp-dropoff').textContent = b.dropoff_point || t.dropoff_point || `Bến xe ${t.destination || ''}`;

    renderQRCode(bookingCode);

    // Bảng hành khách
    const tbody = document.getElementById('bp-passengers-body');
    const rows = currentDetails.length > 0
      ? currentDetails
      : [{
          passenger_name: b.passenger_name || 'Hành khách đặt vé',
          passenger_phone: b.passenger_phone || b.phone || '---',
          seat_number: (b.seats || []).join(', ') || '---',
          price: b.total_amount ?? b.total_price ?? 0,
        }];

    tbody.innerHTML = rows.map((item, idx) => `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-3 text-slate-500">${idx + 1}</td>
        <td class="px-4 py-3 font-medium text-slate-900">${item.passenger_name || item.full_name || 'Hành khách'}</td>
        <td class="px-4 py-3 text-slate-600">${item.passenger_phone || item.phone || '---'}</td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-0.5 rounded-md bg-brand-50 text-brand-700 font-semibold text-xs">
            ${item.seat_number || item.seat_code || item.seat_id || '---'}
          </span>
        </td>
        <td class="px-4 py-3 text-right font-medium text-slate-800">${formatVND(item.price ?? item.seat_price ?? 0)}</td>
      </tr>
    `).join('');

    // Thanh toán
    const total = Number(b.total_amount ?? b.total_price ?? 0);
    document.getElementById('pay-method').textContent = b.payment_method || 'Chuyển khoản / Ví điện tử';
    document.getElementById('pay-seat-count').textContent = `${rows.length} ghế`;
    document.getElementById('pay-created-at').textContent = formatDateTimeVN(b.created_at);
    document.getElementById('pay-total').textContent = formatVND(total);

    const refundRow = document.getElementById('refund-row');
    if (String(b.status).toUpperCase() === 'CANCELLED') {
      refundRow.classList.remove('hidden');
      document.getElementById('pay-refund').textContent = formatVND(b.refund_amount ?? 0);
    } else {
      refundRow.classList.add('hidden');
    }

    const cancelBtn = document.getElementById('btn-open-cancel');
    if (meta.canCancel) {
      cancelBtn.classList.remove('hidden');
    } else {
      cancelBtn.classList.add('hidden');
    }
  }

  function setupCancelModal(bookingId) {
    const modal = document.getElementById('cancel-modal');
    const openBtn = document.getElementById('btn-open-cancel');
    const closeBtn = document.getElementById('btn-close-modal');
    const confirmBtn = document.getElementById('btn-confirm-cancel');

    openBtn.addEventListener('click', () => {
      const calc = calculateRefundPreview();
      const policyText = document.getElementById('cancel-policy-preview');
      const refundText = document.getElementById('cancel-refund-preview');

      if (calc.unpaid) {
        policyText.textContent = 'Vé hiện đang ở trạng thái chờ thanh toán nên sẽ được hủy ngay lập tức mà không phát sinh phí.';
        refundText.textContent = '0đ (Chưa thanh toán)';
        refundText.className = 'font-display font-bold text-base text-slate-600';
      } else if (calc.isEligible100) {
        const hrs = Math.floor(calc.hoursLeft);
        policyText.innerHTML = `Chuyến xe còn khoảng <strong>${hrs} giờ</strong> nữa mới khởi hành (≥ 24 giờ). Bạn đủ điều kiện được <strong>hoàn 100%</strong> tiền vé.`;
        refundText.textContent = formatVND(calc.refundAmount);
        refundText.className = 'font-display font-extrabold text-lg text-emerald-600';
      } else {
        const hrs = Math.max(0, Math.floor(calc.hoursLeft));
        policyText.innerHTML = `Chuyến xe chỉ còn <strong>${hrs} giờ</strong> nữa sẽ khởi hành (< 24 giờ). Theo quy định, vé hủy sát giờ sẽ <strong>không được hoàn tiền</strong>.`;
        refundText.textContent = '0đ';
        refundText.className = 'font-display font-extrabold text-lg text-rose-600';
      }

      modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Đang xử lý...';
      try {
        const userId = getUserId();
        const reason = document.getElementById('cancel-reason').value.trim();
        const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
        const res = await fetchJson(`${BASE_API}/bookings/${bookingId}/cancel${query}`, {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, reason }),
        });

        currentBooking = res.booking || { ...currentBooking, status: 'CANCELLED', refund_amount: res.refund_amount ?? calculateRefundPreview().refundAmount };
        modal.classList.add('hidden');
        renderDetail();
      } catch (err) {
        alert(`Hủy vé thất bại: ${err.message}`);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Xác nhận hủy vé';
      }
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('id') || params.get('booking_id');

    const loadingEl = document.getElementById('detail-loading');
    const errorEl = document.getElementById('detail-error');
    const errorMsgEl = document.getElementById('detail-error-msg');
    const contentEl = document.getElementById('detail-content');

    if (!bookingId) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      errorMsgEl.textContent = 'Thiếu mã vé trên đường dẫn (VD: booking-detail.html?id=1).';
      return;
    }

    try {
      const userId = getUserId();
      const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
      const data = await fetchJson(`${BASE_API}/bookings/${encodeURIComponent(bookingId)}${query}`);

      // Chuẩn hóa cấu trúc trả về từ cả bookings.py lẫn check_bookings.py
      currentBooking = data.booking || data;
      currentDetails = data.details || currentBooking.details || currentBooking.passengers || [];
      currentTrip = data.trip || currentBooking.trip || null;

      if (!currentTrip && currentBooking.trip_id) {
        try {
          currentTrip = await fetchJson(`${BASE_API}/trips/${currentBooking.trip_id}`);
        } catch (_) {}
      }

      loadingEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
      renderDetail();
      setupCancelModal(bookingId);
    } catch (err) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      errorMsgEl.textContent = err.message || 'Không thể tải dữ liệu chi tiết vé.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();