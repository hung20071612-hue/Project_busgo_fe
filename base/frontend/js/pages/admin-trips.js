(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

  let tripsList = [];
  let routesList = [];
  let busesList = [];
  let driversList = [];
  let keyword = '';
  let dateFilter = '';

  function getId(obj, altKey = 'trip_id') {
    return obj?.id ?? obj?.[altKey] ?? null;
  }

  function formatVND(amount) {
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  }

  function formatDateTimeVN(isoStr) {
    if (!isoStr) return '---';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function toDatetimeLocalValue(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function fetchJson(url, options = {}) {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function getStatusBadge(status) {
    const st = String(status || 'SCHEDULED').toUpperCase();
    if (st === 'DEPARTED') return `<span class="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold">Đã xuất bến</span>`;
    if (st === 'COMPLETED') return `<span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">Hoàn thành</span>`;
    if (st === 'CANCELLED') return `<span class="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">Đã hủy</span>`;
    return `<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">Đang mở bán</span>`;
  }

  function renderTable() {
    const tbody = document.getElementById('trips-tbody');
    const filtered = tripsList.filter((t) => {
      if (dateFilter && !String(t.departure_time || '').startsWith(dateFilter)) return false;
      if (!keyword) return true;
      const route = routesList.find((r) => String(getId(r, 'route_id')) === String(t.route_id)) || {};
      const routeText = `${t.origin || route.origin || ''} ${t.destination || route.destination || ''}`.toLowerCase();
      const plate = String(t.license_plate || t.bus_plate || '').toLowerCase();
      return routeText.includes(keyword) || plate.includes(keyword);
    });

    document.getElementById('trip-count').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-slate-400">Không tìm thấy chuyến xe phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((t) => {
      const id = getId(t, 'trip_id');
      const route = routesList.find((r) => String(getId(r, 'route_id')) === String(t.route_id)) || {};
      const bus = busesList.find((b) => String(getId(b, 'bus_id')) === String(t.bus_id)) || {};
      const driver = driversList.find((d) => String(getId(d, 'driver_id')) === String(t.driver_id)) || {};

      const origin = t.origin || route.origin || 'Điểm đi';
      const dest = t.destination || route.destination || 'Điểm đến';
      const plate = t.license_plate || bus.license_plate || (t.bus_id ? `Xe #${t.bus_id}` : 'Chưa gán xe');
      const driverName = t.driver_name || driver.full_name || (t.driver_id ? `Tài xế #${t.driver_id}` : 'Chưa gán tài xế');
      const price = formatVND(t.price ?? t.ticket_price ?? route.base_price ?? 0);

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-600">#TR-${id}</td>
          <td class="px-5 py-3.5 font-semibold text-slate-900">${origin} → ${dest}</td>
          <td class="px-5 py-3.5 text-slate-700 font-medium">${formatDateTimeVN(t.departure_time)}</td>
          <td class="px-5 py-3.5">
            <div class="text-xs font-bold text-slate-800">${plate}</div>
            <div class="text-xs text-slate-500">${driverName}</div>
          </td>
          <td class="px-5 py-3.5 font-display font-bold text-brand-600">${price}</td>
          <td class="px-5 py-3.5">${getStatusBadge(t.status)}</td>
          <td class="px-5 py-3.5 text-right space-x-1.5">
            <button type="button" data-action="edit" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition">
              Sửa
            </button>
            <button type="button" data-action="delete" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 transition">
              Xóa
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateDropdowns() {
    const routeSel = document.getElementById('select-route');
    routeSel.innerHTML = `<option value="">-- Chọn tuyến đường --</option>` + routesList.map((r) => {
      const id = getId(r, 'route_id');
      return `<option value="${id}" data-price="${r.base_price ?? 0}">${r.origin || 'Điểm đi'} → ${r.destination || 'Điểm đến'} (${formatVND(r.base_price ?? 0)})</option>`;
    }).join('');

    const busSel = document.getElementById('select-bus');
    busSel.innerHTML = `<option value="">-- Chọn xe (tùy chọn) --</option>` + busesList.map((b) => {
      const id = getId(b, 'bus_id');
      return `<option value="${id}">${b.license_plate || `Xe #${id}`}</option>`;
    }).join('');

    const driverSel = document.getElementById('select-driver');
    driverSel.innerHTML = `<option value="">-- Chọn tài xế (tùy chọn) --</option>` + driversList.map((d) => {
      const id = getId(d, 'driver_id');
      return `<option value="${id}">${d.full_name || `Tài xế #${id}`} (${d.phone || ''})</option>`;
    }).join('');
  }

  function openModal(trip = null) {
    const modal = document.getElementById('trip-modal');
    const titleEl = document.getElementById('trip-modal-title');
    const idInput = document.getElementById('edit-trip-id');

    if (trip) {
      const id = getId(trip, 'trip_id');
      titleEl.textContent = `Cập nhật chuyến xe #TR-${id}`;
      idInput.value = id;
      document.getElementById('select-route').value = trip.route_id || '';
      document.getElementById('select-bus').value = trip.bus_id || '';
      document.getElementById('select-driver').value = trip.driver_id || '';
      document.getElementById('input-departure').value = toDatetimeLocalValue(trip.departure_time);
      document.getElementById('input-arrival').value = toDatetimeLocalValue(trip.arrival_time);
      document.getElementById('input-trip-price').value = trip.price ?? trip.ticket_price ?? '';
      document.getElementById('select-trip-status').value = String(trip.status || 'SCHEDULED').toUpperCase();
    } else {
      titleEl.textContent = 'Mở chuyến xe mới';
      idInput.value = '';
      document.getElementById('trip-form').reset();
      document.getElementById('select-trip-status').value = 'SCHEDULED';
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('trip-modal').classList.add('hidden');
  }

  async function loadAll() {
    try {
      const [tData, rData, bData, dData] = await Promise.all([
        fetchJson(`${BASE_API}/trips`),
        fetchJson(`${BASE_API}/routes`).catch(() => []),
        fetchJson(`${BASE_API}/buses`).catch(() => []),
        fetchJson(`${BASE_API}/drivers`).catch(() => []),
      ]);

      tripsList = Array.isArray(tData) ? tData : (tData.trips || tData.items || []);
      routesList = Array.isArray(rData) ? rData : (rData.routes || rData.items || []);
      busesList = Array.isArray(bData) ? bData : (bData.buses || bData.items || []);
      driversList = Array.isArray(dData) ? dData : (dData.drivers || dData.items || []);

      populateDropdowns();
      renderTable();
    } catch (err) {
      document.getElementById('trips-tbody').innerHTML =
        `<tr><td colspan="7" class="px-5 py-8 text-center text-rose-600">Lỗi tải danh sách chuyến xe: ${err.message}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAll();

    document.getElementById('trip-search').addEventListener('input', (e) => {
      keyword = e.target.value.trim().toLowerCase();
      renderTable();
    });

    document.getElementById('trip-filter-date').addEventListener('change', (e) => {
      dateFilter = e.target.value;
      renderTable();
    });

    document.getElementById('btn-clear-date').addEventListener('click', () => {
      dateFilter = '';
      document.getElementById('trip-filter-date').value = '';
      renderTable();
    });

    // Tự gợi ý giá vé theo tuyến đường được chọn
    document.getElementById('select-route').addEventListener('change', (e) => {
      const opt = e.target.selectedOptions[0];
      const priceInput = document.getElementById('input-trip-price');
      if (opt && opt.dataset.price && !priceInput.value) {
        priceInput.value = opt.dataset.price;
      }
    });

    document.getElementById('btn-new-trip').addEventListener('click', () => openModal(null));
    document.getElementById('btn-close-trip-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-trip').addEventListener('click', closeModal);

    document.getElementById('trips-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const trip = tripsList.find((t) => String(getId(t, 'trip_id')) === String(id));

      if (btn.dataset.action === 'edit' && trip) {
        openModal(trip);
      } else if (btn.dataset.action === 'delete') {
        if (!confirm(`Xóa chuyến xe #TR-${id}?`)) return;
        try {
          await fetchJson(`${BASE_API}/trips/${id}`, { method: 'DELETE' });
          tripsList = tripsList.filter((t) => String(getId(t, 'trip_id')) !== String(id));
          renderTable();
        } catch (err) {
          alert(`Xóa chuyến thất bại: ${err.message}`);
        }
      }
    });

    document.getElementById('trip-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-trip-id').value;
      const routeId = Number(document.getElementById('select-route').value);
      const busVal = document.getElementById('select-bus').value;
      const driverVal = document.getElementById('select-driver').value;
      const departureTime = document.getElementById('input-departure').value;
      const arrivalTime = document.getElementById('input-arrival').value || null;
      const price = Number(document.getElementById('input-trip-price').value) || 0;
      const status = document.getElementById('select-trip-status').value;

      const selectedRoute = routesList.find((r) => String(getId(r, 'route_id')) === String(routeId)) || {};

      const payload = {
        route_id: routeId,
        origin: selectedRoute.origin,
        destination: selectedRoute.destination,
        bus_id: busVal ? Number(busVal) : null,
        driver_id: driverVal ? Number(driverVal) : null,
        departure_time: departureTime,
        arrival_time: arrivalTime,
        price,
        status,
      };

      const saveBtn = document.getElementById('btn-save-trip');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        if (editId) {
          await fetchJson(`${BASE_API}/trips/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await fetchJson(`${BASE_API}/trips`, { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        await loadAll();
      } catch (err) {
        alert(`Lưu chuyến xe thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu chuyến xe';
      }
    });
  });
})();