(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

  let routesList = [];
  let stationsList = [];
  let keyword = '';

  function getId(obj, altKey = 'route_id') {
    return obj?.id ?? obj?.[altKey] ?? null;
  }

  function formatVND(amount) {
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
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

  function resolveStationName(stationId, fallbackName) {
    if (fallbackName) return fallbackName;
    const st = stationsList.find((s) => String(getId(s, 'station_id')) === String(stationId));
    return st ? (st.name || st.station_name || st.city) : `Bến #${stationId || '?'}`;
  }

  function renderTable() {
    const tbody = document.getElementById('routes-tbody');
    const filtered = routesList.filter((r) => {
      if (!keyword) return true;
      const origin = resolveStationName(r.origin_station_id, r.origin).toLowerCase();
      const dest = resolveStationName(r.destination_station_id, r.destination).toLowerCase();
      return origin.includes(keyword) || dest.includes(keyword);
    });

    document.getElementById('route-total-count').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-slate-400">Chưa có tuyến đường nào khớp điều kiện.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((r) => {
      const id = getId(r, 'route_id');
      const origin = resolveStationName(r.origin_station_id, r.origin);
      const dest = resolveStationName(r.destination_station_id, r.destination);
      const distance = r.distance_km ? `${r.distance_km} km` : '---';
      const duration = r.estimated_duration || (r.duration_minutes ? `${r.duration_minutes} phút` : '---');
      const price = formatVND(r.base_price ?? r.price ?? 0);

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-600">#RT-${id}</td>
          <td class="px-5 py-3.5 font-semibold text-slate-900">${origin}</td>
          <td class="px-5 py-3.5 font-semibold text-slate-900">${dest}</td>
          <td class="px-5 py-3.5 text-slate-600">${distance}</td>
          <td class="px-5 py-3.5 text-slate-600">${duration}</td>
          <td class="px-5 py-3.5 font-display font-bold text-brand-600">${price}</td>
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

  function openModal(route = null) {
    const modal = document.getElementById('route-modal');
    const titleEl = document.getElementById('route-modal-title');
    const idInput = document.getElementById('edit-route-id');

    if (route) {
      titleEl.textContent = `Cập nhật tuyến #RT-${getId(route, 'route_id')}`;
      idInput.value = getId(route, 'route_id');
      document.getElementById('input-origin').value = resolveStationName(route.origin_station_id, route.origin);
      document.getElementById('input-destination').value = resolveStationName(route.destination_station_id, route.destination);
      document.getElementById('input-distance').value = route.distance_km || '';
      document.getElementById('input-duration').value = route.estimated_duration || '';
      document.getElementById('input-base-price').value = route.base_price ?? route.price ?? '';
    } else {
      titleEl.textContent = 'Thêm tuyến đường mới';
      idInput.value = '';
      document.getElementById('route-form').reset();
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('route-modal').classList.add('hidden');
  }

  async function loadData() {
    try {
      const [routesData, stationsData] = await Promise.all([
        fetchJson(`${BASE_API}/admin/routes`),
        fetchJson(`${BASE_API}/admin/stations`).catch(() => []),
      ]);

      routesList = Array.isArray(routesData) ? routesData : (routesData.routes || routesData.items || []);
      stationsList = Array.isArray(stationsData) ? stationsData : (stationsData.stations || stationsData.items || []);

      const datalist = document.getElementById('stations-datalist');
      datalist.innerHTML = stationsList
        .map((s) => `<option value="${s.name || s.station_name || s.city}"></option>`)
        .join('');

      renderTable();
    } catch (err) {
      document.getElementById('routes-tbody').innerHTML =
        `<tr><td colspan="7" class="px-5 py-8 text-center text-rose-600">Lỗi tải danh sách tuyến: ${err.message}</td></tr>`;
    }
  }

  function findStationIdByName(name) {
    const clean = name.trim().toLowerCase();
    const found = stationsList.find(
      (s) => String(s.name || s.station_name || s.city || '').toLowerCase() === clean
    );
    return found ? getId(found, 'station_id') : undefined;
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('route-search').addEventListener('input', (e) => {
      keyword = e.target.value.trim().toLowerCase();
      renderTable();
    });

    document.getElementById('btn-new-route').addEventListener('click', () => openModal(null));
    document.getElementById('btn-close-route-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-route').addEventListener('click', closeModal);

    document.getElementById('routes-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const route = routesList.find((r) => String(getId(r, 'route_id')) === String(id));

      if (btn.dataset.action === 'edit' && route) {
        openModal(route);
      } else if (btn.dataset.action === 'delete') {
        if (!confirm(`Bạn có chắc muốn xóa tuyến #RT-${id}?`)) return;
        try {
          await fetchJson(`${BASE_API}/routes/${id}`, { method: 'DELETE' });
          routesList = routesList.filter((r) => String(getId(r, 'route_id')) !== String(id));
          renderTable();
        } catch (err) {
          alert(`Xóa tuyến thất bại: ${err.message}`);
        }
      }
    });

    document.getElementById('route-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-route-id').value;
      const origin = document.getElementById('input-origin').value.trim();
      const destination = document.getElementById('input-destination').value.trim();
      const distanceKm = Number(document.getElementById('input-distance').value) || null;
      const estimatedDuration = document.getElementById('input-duration').value.trim() || null;
      const basePrice = Number(document.getElementById('input-base-price').value) || 0;

      const payload = {
        code: document.getElementById('input-code').value.trim(),
        departure_id: Number(findStationIdByName(origin)),
        arrival_id: Number(findStationIdByName(destination)),
        distance_km: Number(document.getElementById('input-distance').value),
        estimated_time: Number(document.getElementById('input-duration').value), // nhập số phút (VD: 840)
        base_price: Number(document.getElementById('input-base-price').value) || 0,
        is_active: true,
      };

      const saveBtn = document.getElementById('btn-save-route');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        if (editId) {
          await fetchJson(`${BASE_API}/routes/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await fetchJson(`${BASE_API}/routes`, { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        await loadData();
      } catch (err) {
        alert(`Lưu tuyến đường thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu tuyến đường';
      }
    });
  });
})();