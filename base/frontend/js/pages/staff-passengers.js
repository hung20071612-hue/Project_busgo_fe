(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

  let allTrips = [];
  let currentTripId = null;
  let passengerRows = [];
  let currentFilter = 'ALL';
  let searchKeyword = '';

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

  function getTodayLocalISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
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

  // Lưu trạng thái check-in theo chuyến vào localStorage để đồng bộ ngay cả khi backend chưa có cột boarded
  function getCheckinStorageKey(tripId) {
    return `busgo_staff_checkin_trip_${tripId}`;
  }

  function loadLocalCheckins(tripId) {
    try {
      return JSON.parse(localStorage.getItem(getCheckinStorageKey(tripId)) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveLocalCheckin(tripId, rowKey, isCheckedIn) {
    const map = loadLocalCheckins(tripId);
    map[rowKey] = isCheckedIn;
    localStorage.setItem(getCheckinStorageKey(tripId), JSON.stringify(map));
  }

  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('checkin-toast');
    const icon = document.getElementById('checkin-toast-icon');
    const msg = document.getElementById('checkin-toast-msg');

    toast.className = isSuccess
      ? 'mt-4 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium flex items-center justify-between'
      : 'mt-4 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-medium flex items-center justify-between';
    icon.textContent = isSuccess ? 'check_circle' : 'error';
    msg.textContent = message;
    toast.classList.remove('hidden');
  }

  function renderStaffProfile() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user && (user.full_name || user.name || user.email)) {
        document.getElementById('staff-name').textContent = user.full_name || user.name || user.email;
      }
    } catch (_) {}
  }

  function populateTripSelect(selectedDate = '') {
    const selectEl = document.getElementById('trip-select');
    const filteredTrips = selectedDate
      ? allTrips.filter((t) => String(t.departure_time || '').startsWith(selectedDate))
      : allTrips;

    if (filteredTrips.length === 0) {
      selectEl.innerHTML = `<option value="">Không có chuyến xe nào trong ngày đã chọn</option>`;
      currentTripId = null;
      document.getElementById('trip-banner').classList.add('hidden');
      document.getElementById('table-loading').classList.add('hidden');
      document.getElementById('table-wrapper').classList.add('hidden');
      document.getElementById('table-empty').classList.remove('hidden');
      return;
    }

    selectEl.innerHTML = filteredTrips.map((t) => {
      const origin = t.origin || 'Điểm đi';
      const dest = t.destination || 'Điểm đến';
      const time = formatDateTimeVN(t.departure_time);
      const plate = t.license_plate || t.bus_plate ? ` • ${t.license_plate || t.bus_plate}` : '';
      return `<option value="${t.id}">[Chuyến #${t.id}] ${origin} → ${dest} (${time}${plate})</option>`;
    }).join('');

    const keepPrevious = filteredTrips.some((t) => String(t.id) === String(currentTripId));
    currentTripId = keepPrevious ? currentTripId : filteredTrips[0].id;
    selectEl.value = currentTripId;
    loadTripPassengers(currentTripId);
  }

  async function loadTrips() {
    try {
      const data = await fetchJson(`${BASE_API}/trips`);
      allTrips = Array.isArray(data) ? data : (data.trips || data.items || []);

      const dateInput = document.getElementById('filter-date');
      const today = getTodayLocalISO();
      const hasTodayTrips = allTrips.some((t) => String(t.departure_time || '').startsWith(today));

      if (hasTodayTrips) {
        dateInput.value = today;
        populateTripSelect(today);
      } else {
        dateInput.value = '';
        populateTripSelect('');
      }
    } catch (err) {
      document.getElementById('table-loading').classList.add('hidden');
      document.getElementById('table-error').classList.remove('hidden');
      document.getElementById('table-error-msg').textContent = `Không tải được danh sách chuyến xe: ${err.message}`;
    }
  }

  function updateTripBannerAndStats(trip) {
    const banner = document.getElementById('trip-banner');
    if (!trip) {
      banner.classList.add('hidden');
      return;
    }

    banner.classList.remove('hidden');
    document.getElementById('banner-route').textContent = `${trip.origin || 'Điểm đi'} → ${trip.destination || 'Điểm đến'}`;
    document.getElementById('banner-time').textContent = formatDateTimeVN(trip.departure_time);
    document.getElementById('banner-bus').textContent = trip.bus_type_name || trip.bus_type || 'Xe khách';
    document.getElementById('banner-plate').textContent = trip.license_plate || trip.bus_plate || 'Chưa gắn biển số';

    const totalSeats = Number(trip.total_seats || trip.capacity || 40);
    const bookedCount = passengerRows.length;
    const checkedInCount = passengerRows.filter((r) => r.checkedIn).length;
    const remainingCount = Math.max(0, bookedCount - checkedInCount);

    document.getElementById('stat-booked').textContent = `${bookedCount} / ${totalSeats}`;
    document.getElementById('stat-checked-in').textContent = checkedInCount;
    document.getElementById('stat-remaining').textContent = remainingCount;
  }

  function normalizeBookedSeatsResponse(rawData, tripId) {
    const localMap = loadLocalCheckins(tripId);
    const list = Array.isArray(rawData)
      ? rawData
      : (rawData.booked_seats || rawData.seats || rawData.passengers || rawData.items || []);

    return list
      .map((item, idx) => {
        // Trường hợp API chỉ trả mảng chuỗi số ghế ["A01", "A02"]
        if (typeof item === 'string' || typeof item === 'number') {
          const seatCode = String(item);
          const rowKey = `seat_${seatCode}`;
          return {
            rowKey,
            detailId: null,
            bookingId: null,
            bookingCode: '---',
            seatNumber: seatCode,
            passengerName: 'Hành khách đã đặt ghế',
            passengerPhone: '---',
            pickupPoint: 'Tại bến xuất phát',
            paymentStatus: 'PAID',
            checkedIn: Boolean(localMap[rowKey]),
          };
        }

        // Trường hợp API trả object chi tiết ghế / hành khách
        const seatNumber = item.seat_number || item.seat_code || item.seat_name || String(item.seat_id || idx + 1);
        const bookingId = item.booking_id || item.booking?.id || null;
        const bookingCode = item.booking_code || item.booking?.booking_code || (bookingId ? `BG${String(bookingId).padStart(4, '0')}` : '---');
        const detailId = item.detail_id || item.id || null;
        const rowKey = detailId ? `detail_${detailId}` : `seat_${seatNumber}_${bookingId || idx}`;

        const backendCheckedIn = Boolean(item.is_checked_in || item.checked_in || item.boarded);
        const checkedIn = localMap[rowKey] !== undefined ? Boolean(localMap[rowKey]) : backendCheckedIn;

        return {
          rowKey,
          detailId,
          bookingId,
          bookingCode,
          seatNumber,
          passengerName: item.passenger_name || item.full_name || item.user_name || 'Hành khách',
          passengerPhone: item.passenger_phone || item.phone || item.user_phone || '---',
          pickupPoint: item.pickup_point || item.boarding_point || 'Tại bến xe',
          paymentStatus: String(item.status || item.booking_status || item.payment_status || 'PAID').toUpperCase(),
          checkedIn,
        };
      })
      .filter((row) => row.paymentStatus !== 'CANCELLED')
      .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, 'vi', { numeric: true }));
  }

  async function loadTripPassengers(tripId) {
    if (!tripId) return;
    const loadingEl = document.getElementById('table-loading');
    const errorEl = document.getElementById('table-error');
    const emptyEl = document.getElementById('table-empty');
    const wrapperEl = document.getElementById('table-wrapper');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    wrapperEl.classList.add('hidden');

    const trip = allTrips.find((t) => String(t.id) === String(tripId)) || null;

    try {
      const data = await fetchJson(`${BASE_API}/bookings/trips/${encodeURIComponent(tripId)}/booked-seats`);
      passengerRows = normalizeBookedSeatsResponse(data, tripId);

      loadingEl.classList.add('hidden');
      updateTripBannerAndStats(trip);
      renderPassengersTable();
    } catch (err) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      document.getElementById('table-error-msg').textContent = `Không tải được danh sách ghế đã đặt: ${err.message}`;
    }
  }

  function renderPassengersTable() {
    const emptyEl = document.getElementById('table-empty');
    const wrapperEl = document.getElementById('table-wrapper');
    const tbody = document.getElementById('passengers-tbody');

    const filtered = passengerRows.filter((row) => {
      if (currentFilter === 'BOARDED' && !row.checkedIn) return false;
      if (currentFilter === 'NOT_BOARDED' && row.checkedIn) return false;
      if (currentFilter === 'UNPAID' && (row.paymentStatus === 'PAID' || row.paymentStatus === 'CONFIRMED')) return false;

      if (!searchKeyword) return true;
      const kw = searchKeyword.toLowerCase();
      return (
        row.passengerName.toLowerCase().includes(kw) ||
        row.passengerPhone.toLowerCase().includes(kw) ||
        row.seatNumber.toLowerCase().includes(kw) ||
        row.bookingCode.toLowerCase().includes(kw)
      );
    });

    if (filtered.length === 0) {
      wrapperEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    wrapperEl.classList.remove('hidden');

    tbody.innerHTML = filtered.map((row, index) => {
      const isPaid = row.paymentStatus === 'PAID' || row.paymentStatus === 'CONFIRMED';
      const payBadge = isPaid
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">Đã thanh toán</span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">Chờ thanh toán</span>`;

      const actionBtn = row.checkedIn
        ? `<button
             type="button"
             data-row-key="${row.rowKey}"
             class="btn-toggle-checkin inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
           >
             <span class="material-symbols-outlined text-[16px]">check_circle</span>
             Đã lên xe
           </button>`
        : `<button
             type="button"
             data-row-key="${row.rowKey}"
             class="btn-toggle-checkin inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-500 text-brand-700 hover:text-white border border-brand-200 hover:border-brand-500 text-xs font-semibold transition"
           >
             <span class="material-symbols-outlined text-[16px]">how_to_reg</span>
             Xác nhận lên xe
           </button>`;

      return `
        <tr class="${row.checkedIn ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'} transition">
          <td class="px-4 py-3.5 text-slate-500 font-medium">${index + 1}</td>
          <td class="px-4 py-3.5">
            <span class="inline-flex items-center justify-center min-w-[44px] px-2.5 py-1 rounded-lg bg-slate-900 text-white font-display font-bold text-xs">
              ${row.seatNumber}
            </span>
          </td>
          <td class="px-4 py-3.5 font-mono text-xs font-bold text-slate-700">#${row.bookingCode}</td>
          <td class="px-4 py-3.5 font-semibold text-slate-900">${row.passengerName}</td>
          <td class="px-4 py-3.5 text-slate-600 font-medium">${row.passengerPhone}</td>
          <td class="px-4 py-3.5 text-slate-600">${row.pickupPoint}</td>
          <td class="px-4 py-3.5">${payBadge}</td>
          <td class="px-4 py-3.5 text-right no-print">${actionBtn}</td>
        </tr>
      `;
    }).join('');
  }

  async function togglePassengerCheckin(rowKey, forceState = null) {
    const row = passengerRows.find((r) => r.rowKey === rowKey);
    if (!row) return;

    const nextState = forceState !== null ? forceState : !row.checkedIn;
    row.checkedIn = nextState;
    saveLocalCheckin(currentTripId, rowKey, nextState);

    // Gọi API check-in nếu backend hỗ trợ, không làm gián đoạn thao tác tại bến nếu endpoint chưa mở
    if (row.detailId) {
      fetchJson(`${BASE_API}/bookings/details/${row.detailId}/checkin`, {
        method: 'PATCH',
        body: JSON.stringify({ checked_in: nextState }),
      }).catch(() => {});
    }

    const trip = allTrips.find((t) => String(t.id) === String(currentTripId)) || null;
    updateTripBannerAndStats(trip);
    renderPassengersTable();

    if (nextState) {
      showToast(`Đã xác nhận hành khách ${row.passengerName} (Ghế ${row.seatNumber}) lên xe.`, true);
    } else {
      showToast(`Đã hủy trạng thái lên xe của ghế ${row.seatNumber}.`, true);
    }
  }

  function handleQuickQrCheckin(rawCode) {
    const cleaned = rawCode.trim().replace(/^BUSGO:/i, '').replace(/^#/, '').toUpperCase();
    if (!cleaned) return;

    const matchedRows = passengerRows.filter((r) => {
      const codeUpper = r.bookingCode.toUpperCase();
      const numericId = r.bookingId ? String(r.bookingId) : '';
      return codeUpper === cleaned || numericId === cleaned || codeUpper.endsWith(cleaned);
    });

    if (matchedRows.length === 0) {
      showToast(`Không tìm thấy vé "${cleaned}" trên chuyến xe đang chọn.`, false);
      return;
    }

    matchedRows.forEach((r) => {
      r.checkedIn = true;
      saveLocalCheckin(currentTripId, r.rowKey, true);
    });

    const trip = allTrips.find((t) => String(t.id) === String(currentTripId)) || null;
    updateTripBannerAndStats(trip);
    renderPassengersTable();

    const seats = matchedRows.map((r) => r.seatNumber).join(', ');
    showToast(`Check-in thành công vé #${matchedRows[0].bookingCode} — Ghế: ${seats}`, true);
  }

  function setupEvents() {
    document.getElementById('filter-date').addEventListener('change', (e) => {
      populateTripSelect(e.target.value);
    });

    document.getElementById('btn-all-dates').addEventListener('click', () => {
      document.getElementById('filter-date').value = '';
      populateTripSelect('');
    });

    document.getElementById('trip-select').addEventListener('change', (e) => {
      currentTripId = e.target.value;
      loadTripPassengers(currentTripId);
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      if (currentTripId) loadTripPassengers(currentTripId);
    });

    document.getElementById('quick-checkin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('quick-checkin-input');
      handleQuickQrCheckin(input.value);
      input.value = '';
    });

    document.getElementById('passenger-search').addEventListener('input', (e) => {
      searchKeyword = e.target.value.trim();
      renderPassengersTable();
    });

    document.querySelectorAll('.p-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('.p-filter-btn').forEach((b) => {
          const active = b === btn;
          b.className = active
            ? 'p-filter-btn px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white transition'
            : 'p-filter-btn px-3.5 py-2 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition';
        });
        renderPassengersTable();
      });
    });

    document.getElementById('passengers-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle-checkin');
      if (!btn) return;
      togglePassengerCheckin(btn.dataset.rowKey);
    });
  }

    document.querySelectorAll("aside a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const isStaffLink =
        href.includes("staff-passengers.html") || href.includes("staff-checkin.html");
      link.classList.remove("bg-brand-500", "text-white", "font-semibold", "shadow-sm");
      if (isStaffLink) {
        link.classList.add("bg-brand-500", "text-white", "font-semibold", "shadow-sm");
      }
    });

  document.addEventListener('DOMContentLoaded', () => {
    renderStaffProfile();
    setupEvents();
    loadTrips();
  });
})();