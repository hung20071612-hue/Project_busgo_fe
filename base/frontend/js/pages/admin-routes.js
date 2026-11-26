(() => {
  const BASE_API =
    typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL
      ? CONFIG.API_BASE_URL
      : 'http://127.0.0.1:8000/api';

  let routesList = [];
  let stationsList = [];
  let keyword = '';

  function getId(obj, altKey = 'route_id') {
    return obj?.id ?? obj?.[altKey] ?? null;
  }

  function safeText(val) {
    if (typeof escapeHtml === 'function') return escapeHtml(val);
    const div = document.createElement('div');
    div.textContent = val ?? '';
    return div.innerHTML;
  }

  function formatVND(amount) {
    if (typeof formatMoney === 'function') return formatMoney(amount);
    return Number(amount || 0).toLocaleString('vi-VN') + ' ₫';
  }

  async function fetchJson(url, options = {}) {
    const token =
      (typeof Auth !== 'undefined' && Auth.getToken()) ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = Array.isArray(err.detail)
          ? err.detail.map((e) => e.msg).join(', ')
          : err.detail || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function resolveStationName(stationId, fallbackName) {
    if (fallbackName) return fallbackName;
    const st = stationsList.find(
      (s) => String(getId(s, 'station_id')) === String(stationId)
    );
    return st ? st.name || st.station_name || st.city : `Bến #${stationId || '?'}`;
  }

  function populateStationSelects() {
    const depSel = document.getElementById('input-departure');
    const arrSel = document.getElementById('input-arrival');
    if (!depSel || !arrSel) return;

    const optionsHtml = stationsList
      .map((s) => {
        const id = getId(s, 'station_id');
        const label = s.city ? `${s.name} (${s.city})` : s.name;
        const inactiveNote = s.is_active === false ? ' [Ngừng hoạt động]' : '';
        return `<option value="${id}">${safeText(label + inactiveNote)}</option>`;
      })
      .join('');

    depSel.innerHTML = `<option value="">-- Chọn bến đi --</option>${optionsHtml}`;
    arrSel.innerHTML = `<option value="">-- Chọn bến đến --</option>${optionsHtml}`;
  }

  function getStatusBadge(isActive) {
    if (isActive === false) {
      return `<span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold">Ngừng hoạt động</span>`;
    }
    return `<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">Đang hoạt động</span>`;
  }

  function renderTable() {
    const tbody = document.getElementById('routes-tbody');
    const filtered = routesList.filter((r) => {
      if (!keyword) return true;
      const code = String(r.code || '').toLowerCase();
      const depId = r.departure_id ?? r.origin_station_id;
      const arrId = r.arrival_id ?? r.destination_station_id;
      const origin = resolveStationName(depId, r.origin).toLowerCase();
      const dest = resolveStationName(arrId, r.destination).toLowerCase();
      return code.includes(keyword) || origin.includes(keyword) || dest.includes(keyword);
    });

    document.getElementById('route-total-count').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-8 text-center text-slate-400">Không tìm thấy tuyến đường phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((r) => {
        const id = getId(r, 'route_id');
        const code = r.code || `#RT-${id}`;
        const depId = r.departure_id ?? r.origin_station_id;
        const arrId = r.arrival_id ?? r.destination_station_id;
        const origin = resolveStationName(depId, r.origin);
        const dest = resolveStationName(arrId, r.destination);
        const distance = r.distance_km ? `${r.distance_km} km` : '---';
        const minutes = r.estimated_time ?? r.duration_minutes;
        const duration = minutes ? `${minutes} phút` : r.estimated_duration || '---';
        const price = formatVND(r.base_price ?? r.price ?? 0);

        return `
          <tr class="hover:bg-slate-50/80 transition">
            <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-700">${safeText(code)}</td>
            <td class="px-5 py-3.5 font-semibold text-slate-900">${safeText(origin)}</td>
            <td class="px-5 py-3.5 font-semibold text-slate-900">${safeText(dest)}</td>
            <td class="px-5 py-3.5 text-slate-600">${safeText(distance)}</td>
            <td class="px-5 py-3.5 text-slate-600">${safeText(duration)}</td>
            <td class="px-5 py-3.5 font-display font-bold text-brand-600">${price}</td>
            <td class="px-5 py-3.5">${getStatusBadge(r.is_active)}</td>
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
      })
      .join('');
  }

  function openModal(route = null) {
    const modal = document.getElementById('route-modal');
    const titleEl = document.getElementById('route-modal-title');
    const idInput = document.getElementById('edit-route-id');

    populateStationSelects();

    if (route) {
      const id = getId(route, 'route_id');
      titleEl.textContent = `Cập nhật tuyến ${route.code || `#RT-${id}`}`;
      idInput.value = id;
      document.getElementById('input-code').value = route.code || '';
      document.getElementById('input-active').value =
        route.is_active === false ? 'false' : 'true';
      document.getElementById('input-departure').value =
        route.departure_id ?? route.origin_station_id ?? '';
      document.getElementById('input-arrival').value =
        route.arrival_id ?? route.destination_station_id ?? '';
      document.getElementById('input-distance').value = route.distance_km ?? '';
      document.getElementById('input-duration').value =
        route.estimated_time ?? route.duration_minutes ?? '';
      document.getElementById('input-base-price').value =
        route.base_price ?? route.price ?? '';
    } else {
      titleEl.textContent = 'Thêm tuyến đường mới';
      idInput.value = '';
      document.getElementById('route-form').reset();
      document.getElementById('input-active').value = 'true';
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('route-modal').classList.add('hidden');
  }

  function openStationModal() {
    document.getElementById('station-form').reset();
    document.getElementById('station-modal').classList.remove('hidden');
  }

  function closeStationModal() {
    document.getElementById('station-modal').classList.add('hidden');
  }

  async function loadData() {
    try {
      const [routesData, stationsData] = await Promise.all([
        fetchJson(`${BASE_API}/admin/routes`),
        fetchJson(`${BASE_API}/admin/stations`).catch(() => []),
      ]);

      routesList = Array.isArray(routesData)
        ? routesData
        : routesData.routes || routesData.items || [];
      stationsList = Array.isArray(stationsData)
        ? stationsData
        : stationsData.stations || stationsData.items || [];

      populateStationSelects();
      renderTable();
    } catch (err) {
      document.getElementById('routes-tbody').innerHTML =
        `<tr><td colspan="8" class="px-5 py-8 text-center text-rose-600">Lỗi tải danh sách tuyến: ${safeText(err.message)}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth !== 'undefined' && !Auth.requireAuth(['ADMIN'])) {
      return;
    }

    loadData();

    document.getElementById('route-search').addEventListener('input', (e) => {
      keyword = e.target.value.trim().toLowerCase();
      renderTable();
    });

    const newRouteBtn = document.getElementById('btn-new-route');
    if (newRouteBtn) {
      newRouteBtn.addEventListener('click', () => openModal(null));
    }
    document.getElementById('btn-close-route-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-route').addEventListener('click', closeModal);

    const newStationBtn = document.getElementById('btn-new-station');
    if (newStationBtn) {
      newStationBtn.addEventListener('click', openStationModal);
    }
    document
      .getElementById('btn-close-station-modal')
      .addEventListener('click', closeStationModal);
    document
      .getElementById('btn-cancel-station')
      .addEventListener('click', closeStationModal);

    document.getElementById('routes-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const route = routesList.find(
        (r) => String(getId(r, 'route_id')) === String(id)
      );

      if (btn.dataset.action === 'edit' && route) {
        openModal(route);
      } else if (btn.dataset.action === 'delete') {
        const label = route?.code || `#RT-${id}`;
        if (!confirm(`Bạn có chắc muốn xóa tuyến ${label}?`)) return;
        try {
          const res = await fetchJson(`${BASE_API}/admin/routes/${id}`, {
            method: 'DELETE',
          });
          if (res?.message && typeof showToast === 'function') {
            showToast(res.message, 'success');
          }
          await loadData();
        } catch (err) {
          alert(`Xóa tuyến thất bại: ${err.message}`);
        }
      }
    });

    document.getElementById('route-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-route-id').value;
      const departureId = Number(document.getElementById('input-departure').value);
      const arrivalId = Number(document.getElementById('input-arrival').value);

      if (!departureId || !arrivalId) {
        alert('Vui lòng chọn đầy đủ bến xuất phát và bến đến.');
        return;
      }
      if (departureId === arrivalId) {
        alert('Bến xuất phát và bến đến không được trùng nhau.');
        return;
      }

      const payload = {
        code: document.getElementById('input-code').value.trim().toUpperCase(),
        departure_id: departureId,
        arrival_id: arrivalId,
        distance_km: Number(document.getElementById('input-distance').value),
        estimated_time: Number(document.getElementById('input-duration').value),
        base_price: Number(document.getElementById('input-base-price').value) || 0,
        is_active: document.getElementById('input-active').value === 'true',
      };

      const saveBtn = document.getElementById('btn-save-route');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        if (editId) {
          await fetchJson(`${BASE_API}/admin/routes/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await fetchJson(`${BASE_API}/admin/routes`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        closeModal();
        if (typeof showToast === 'function') {
          showToast(
            editId ? 'Cập nhật tuyến đường thành công' : 'Thêm tuyến đường thành công',
            'success'
          );
        }
        await loadData();
      } catch (err) {
        alert(`Lưu tuyến đường thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu tuyến đường';
      }
    });

    document.getElementById('station-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('st-name').value.trim(),
        city: document.getElementById('st-city').value.trim(),
        address: document.getElementById('st-address').value.trim() || null,
        is_active: true,
      };

      const saveBtn = document.getElementById('btn-save-station');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        await fetchJson(`${BASE_API}/admin/stations`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        closeStationModal();
        if (typeof showToast === 'function') {
          showToast('Đã thêm bến xe mới', 'success');
        }
        await loadData();
      } catch (err) {
        alert(`Thêm bến xe thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu bến xe';
      }
    });
  });
})();