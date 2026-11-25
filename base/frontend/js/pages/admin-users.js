(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

  let activeTab = 'users'; // 'users' | 'drivers'
  let usersList = [];
  let driversList = [];

  let userSearch = '';
  let userRoleFilter = 'ALL';
  let driverSearch = '';
  let driverStatusFilter = 'ALL';

  function getId(obj, altKey) {
    return obj?.id ?? obj?.[altKey] ?? null;
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
      const error = new Error(detail);
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function normalizeRole(role) {
    const r = String(role || 'USER').toUpperCase();
    if (r === 'ADMIN') return 'ADMIN';
    if (r === 'STAFF') return 'STAFF';
    return 'CUSTOMER';
  }

  function getRoleBadge(role) {
    const norm = normalizeRole(role);
    if (norm === 'ADMIN') {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold">ADMIN</span>`;
    }
    if (norm === 'STAFF') {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold">STAFF</span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">KHÁCH HÀNG</span>`;
  }

  function getDriverStatusBadge(status) {
    const st = String(status || 'AVAILABLE').toUpperCase();
    if (st === 'ON_TRIP' || st === 'BUSY') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Đang chạy tuyến</span>`;
    }
    if (st === 'OFF_DUTY' || st === 'INACTIVE') {
      return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Tạm ngưng</span>`;
    }
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Sẵn sàng</span>`;
  }

  function updateKPIs() {
    const adminCount = usersList.filter((u) => normalizeRole(u.role) === 'ADMIN').length;
    const staffCount = usersList.filter((u) => normalizeRole(u.role) === 'STAFF').length;
    const customerCount = usersList.length - adminCount - staffCount;

    document.getElementById('kpi-total-users').textContent = usersList.length;
    document.getElementById('kpi-users-breakdown').textContent = `${customerCount} khách hàng • ${adminCount + staffCount} nhân sự nội bộ`;
    document.getElementById('kpi-staff-admin').textContent = adminCount + staffCount;
    document.getElementById('kpi-staff-breakdown').textContent = `${adminCount} Admin • ${staffCount} Nhân viên soát vé`;

    const availableDrivers = driversList.filter(
      (d) => String(d.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE'
    ).length;
    document.getElementById('kpi-total-drivers').textContent = `${driversList.length} tài xế`;
    document.getElementById('kpi-drivers-breakdown').textContent = `${availableDrivers} sẵn sàng nhận chuyến`;

    document.getElementById('count-users-tab').textContent = usersList.length;
    document.getElementById('count-drivers-tab').textContent = driversList.length;
  }

  function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    const filtered = usersList.filter((u) => {
      if (userRoleFilter !== 'ALL' && normalizeRole(u.role) !== userRoleFilter) return false;
      if (!userSearch) return true;
      const kw = userSearch.toLowerCase();
      const name = String(u.full_name || u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const phone = String(u.phone || '').toLowerCase();
      return name.includes(kw) || email.includes(kw) || phone.includes(kw);
    });

    document.getElementById('user-visible-count').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Không tìm thấy tài khoản nào phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((u) => {
      const id = getId(u, 'user_id');
      const name = u.full_name || u.name || 'Người dùng';
      const isActive = u.is_active !== false && String(u.status || 'ACTIVE').toUpperCase() !== 'LOCKED';

      const statusBadge = isActive
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">Hoạt động</span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">Đã khóa</span>`;

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-500">#${id}</td>
          <td class="px-5 py-3.5 font-semibold text-slate-900">${name}</td>
          <td class="px-5 py-3.5">
            <div class="text-slate-800 font-medium">${u.email || '---'}</div>
            <div class="text-xs text-slate-500">${u.phone || 'Chưa cập nhật SĐT'}</div>
          </td>
          <td class="px-5 py-3.5">${getRoleBadge(u.role)}</td>
          <td class="px-5 py-3.5">${statusBadge}</td>
          <td class="px-5 py-3.5 text-right space-x-1.5">
            <button type="button" data-u-action="toggle-lock" data-id="${id}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-600 transition">
              ${isActive ? 'Khóa' : 'Mở khóa'}
            </button>
            <button type="button" data-u-action="edit" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition">
              Sửa
            </button>
            <button type="button" data-u-action="delete" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 transition">
              Xóa
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDriversTable() {
    const tbody = document.getElementById('drivers-tbody');
    const filtered = driversList.filter((d) => {
      const st = String(d.status || 'AVAILABLE').toUpperCase();
      if (driverStatusFilter !== 'ALL' && st !== driverStatusFilter) return false;
      if (!driverSearch) return true;
      const kw = driverSearch.toLowerCase();
      const name = String(d.full_name || d.name || '').toLowerCase();
      const phone = String(d.phone || '').toLowerCase();
      const license = String(d.license_number || '').toLowerCase();
      return name.includes(kw) || phone.includes(kw) || license.includes(kw);
    });

    document.getElementById('driver-visible-count').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-slate-400">Không tìm thấy hồ sơ tài xế nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((d) => {
      const id = getId(d, 'driver_id');
      const name = d.full_name || d.name || 'Tài xế';
      const licenseNo = d.license_number || 'Đang cập nhật';
      const licenseClass = d.license_class ? `Hạng ${d.license_class}` : '';
      const exp = d.experience_years !== undefined && d.experience_years !== null ? `${d.experience_years} năm` : '---';

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-500">#TX-${id}</td>
          <td class="px-5 py-3.5 font-semibold text-slate-900">${name}</td>
          <td class="px-5 py-3.5 font-medium text-slate-700">${d.phone || '---'}</td>
          <td class="px-5 py-3.5">
            <span class="font-mono text-xs font-bold text-slate-800">${licenseNo}</span>
            ${licenseClass ? `<span class="ml-1.5 px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[11px] font-semibold">${licenseClass}</span>` : ''}
          </td>
          <td class="px-5 py-3.5 text-slate-600">${exp}</td>
          <td class="px-5 py-3.5">${getDriverStatusBadge(d.status)}</td>
          <td class="px-5 py-3.5 text-right space-x-1.5">
            <button type="button" data-d-action="edit" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition">
              Sửa
            </button>
            <button type="button" data-d-action="delete" data-id="${id}" class="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 transition">
              Xóa
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function switchTab(tab) {
    activeTab = tab;
    const isUsers = tab === 'users';

    document.getElementById('panel-users').classList.toggle('hidden', !isUsers);
    document.getElementById('panel-drivers').classList.toggle('hidden', isUsers);

    const tabUsersBtn = document.getElementById('tab-users');
    const tabDriversBtn = document.getElementById('tab-drivers');
    const countUsersBadge = document.getElementById('count-users-tab');
    const countDriversBadge = document.getElementById('count-drivers-tab');

    tabUsersBtn.className = isUsers
      ? 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white transition'
      : 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
    countUsersBadge.className = isUsers
      ? 'px-2 py-0.5 text-xs rounded-full bg-white/20 text-white'
      : 'px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600';

    tabDriversBtn.className = !isUsers
      ? 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white transition'
      : 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition';
    countDriversBadge.className = !isUsers
      ? 'px-2 py-0.5 text-xs rounded-full bg-white/20 text-white'
      : 'px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600';

    document.getElementById('btn-primary-add-label').textContent = isUsers ? 'Thêm tài khoản' : 'Thêm tài xế';
  }

  function openUserModal(user = null) {
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('edit-user-id');
    const pwdInput = document.getElementById('u-password');
    const pwdHint = document.getElementById('u-password-hint');

    if (user) {
      const id = getId(user, 'user_id');
      title.textContent = `Cập nhật tài khoản #${id}`;
      idInput.value = id;
      document.getElementById('u-fullname').value = user.full_name || user.name || '';
      document.getElementById('u-email').value = user.email || '';
      document.getElementById('u-phone').value = user.phone || '';
      pwdInput.value = '';
      pwdInput.required = false;
      pwdHint.textContent = '(Bỏ trống nếu giữ nguyên)';
      const norm = normalizeRole(user.role);
      document.getElementById('u-role').value = norm === 'CUSTOMER' ? 'USER' : norm;
      document.getElementById('u-active').checked = user.is_active !== false;
    } else {
      title.textContent = 'Thêm tài khoản mới';
      idInput.value = '';
      document.getElementById('user-form').reset();
      pwdInput.required = true;
      pwdHint.textContent = '*';
      document.getElementById('u-active').checked = true;
    }

    modal.classList.remove('hidden');
  }

  function openDriverModal(driver = null) {
    const modal = document.getElementById('driver-modal');
    const title = document.getElementById('driver-modal-title');
    const idInput = document.getElementById('edit-driver-id');

    if (driver) {
      const id = getId(driver, 'driver_id');
      title.textContent = `Cập nhật hồ sơ tài xế #TX-${id}`;
      idInput.value = id;
      document.getElementById('d-fullname').value = driver.full_name || driver.name || '';
      document.getElementById('d-phone').value = driver.phone || '';
      document.getElementById('d-license-no').value = driver.license_number || '';
      document.getElementById('d-license-class').value = driver.license_class || 'E';
      document.getElementById('d-exp-years').value = driver.experience_years ?? 3;
      document.getElementById('d-status').value = String(driver.status || 'AVAILABLE').toUpperCase();
    } else {
      title.textContent = 'Thêm hồ sơ tài xế';
      idInput.value = '';
      document.getElementById('driver-form').reset();
      document.getElementById('d-license-class').value = 'E';
      document.getElementById('d-exp-years').value = 3;
      document.getElementById('d-status').value = 'AVAILABLE';
    }

    modal.classList.remove('hidden');
  }

  async function loadAllData() {
    try {
      const [uData, dData] = await Promise.all([
        fetchJson(`${BASE_API}/users`).catch(() => []),
        fetchJson(`${BASE_API}/drivers`).catch(() => []),
      ]);

      usersList = Array.isArray(uData) ? uData : (uData.users || uData.items || []);
      driversList = Array.isArray(dData) ? dData : (dData.drivers || dData.items || []);

      updateKPIs();
      renderUsersTable();
      renderDriversTable();
    } catch (err) {
      console.error('Lỗi tải dữ liệu người dùng & tài xế:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAllData();

    // Tab switching
    document.getElementById('tab-users').addEventListener('click', () => switchTab('users'));
    document.getElementById('tab-drivers').addEventListener('click', () => switchTab('drivers'));

    document.getElementById('btn-primary-add').addEventListener('click', () => {
      if (activeTab === 'users') openUserModal(null);
      else openDriverModal(null);
    });

    // Filters
    document.getElementById('user-search').addEventListener('input', (e) => {
      userSearch = e.target.value.trim();
      renderUsersTable();
    });
    document.getElementById('user-role-filter').addEventListener('change', (e) => {
      userRoleFilter = e.target.value;
      renderUsersTable();
    });

    document.getElementById('driver-search').addEventListener('input', (e) => {
      driverSearch = e.target.value.trim();
      renderDriversTable();
    });
    document.getElementById('driver-status-filter').addEventListener('change', (e) => {
      driverStatusFilter = e.target.value;
      renderDriversTable();
    });

    // Modal closers
    document.getElementById('btn-close-user-modal').addEventListener('click', () => document.getElementById('user-modal').classList.add('hidden'));
    document.getElementById('btn-cancel-user').addEventListener('click', () => document.getElementById('user-modal').classList.add('hidden'));

    document.getElementById('btn-close-driver-modal').addEventListener('click', () => document.getElementById('driver-modal').classList.add('hidden'));
    document.getElementById('btn-cancel-driver').addEventListener('click', () => document.getElementById('driver-modal').classList.add('hidden'));

    // Users table actions
    document.getElementById('users-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-u-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const user = usersList.find((u) => String(getId(u, 'user_id')) === String(id));
      if (!user) return;

      const action = btn.dataset.uAction;
      if (action === 'edit') {
        openUserModal(user);
      } else if (action === 'toggle-lock') {
        const nextActive = !(user.is_active !== false);
        try {
          await fetchJson(`${BASE_API}/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...user, is_active: nextActive }),
          });
          user.is_active = nextActive;
          renderUsersTable();
        } catch (err) {
          alert(`Cập nhật trạng thái tài khoản thất bại: ${err.message}`);
        }
      } else if (action === 'delete') {
        if (!confirm(`Bạn có chắc muốn xóa tài khoản "${user.full_name || user.email}"?`)) return;
        try {
          await fetchJson(`${BASE_API}/users/${id}`, { method: 'DELETE' });
          usersList = usersList.filter((u) => String(getId(u, 'user_id')) !== String(id));
          updateKPIs();
          renderUsersTable();
        } catch (err) {
          alert(`Xóa tài khoản thất bại: ${err.message}`);
        }
      }
    });

    // Drivers table actions
    document.getElementById('drivers-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-d-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const driver = driversList.find((d) => String(getId(d, 'driver_id')) === String(id));
      if (!driver) return;

      const action = btn.dataset.dAction;
      if (action === 'edit') {
        openDriverModal(driver);
      } else if (action === 'delete') {
        if (!confirm(`Xóa hồ sơ tài xế "${driver.full_name}"?`)) return;
        try {
          await fetchJson(`${BASE_API}/drivers/${id}`, { method: 'DELETE' });
          driversList = driversList.filter((d) => String(getId(d, 'driver_id')) !== String(id));
          updateKPIs();
          renderDriversTable();
        } catch (err) {
          alert(`Xóa tài xế thất bại: ${err.message}`);
        }
      }
    });

    // Submit User Form
    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-user-id').value;
      const password = document.getElementById('u-password').value;

      const payload = {
        full_name: document.getElementById('u-fullname').value.trim(),
        email: document.getElementById('u-email').value.trim(),
        phone: document.getElementById('u-phone').value.trim() || null,
        role: document.getElementById('u-role').value,
        is_active: document.getElementById('u-active').checked,
      };
      if (password) payload.password = password;

      const saveBtn = document.getElementById('btn-save-user');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        if (editId) {
          await fetchJson(`${BASE_API}/users/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          try {
            await fetchJson(`${BASE_API}/users`, { method: 'POST', body: JSON.stringify(payload) });
          } catch (err) {
            // Fallback sang /auth/register nếu backend tách endpoint đăng ký
            if (err.status === 404 || err.status === 405) {
              await fetchJson(`${BASE_API}/auth/register`, { method: 'POST', body: JSON.stringify(payload) });
            } else {
              throw err;
            }
          }
        }
        document.getElementById('user-modal').classList.add('hidden');
        await loadAllData();
      } catch (err) {
        alert(`Lưu tài khoản thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu tài khoản';
      }
    });

    // Submit Driver Form
    document.getElementById('driver-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-driver-id').value;

      const payload = {
        full_name: document.getElementById('d-fullname').value.trim(),
        phone: document.getElementById('d-phone').value.trim(),
        license_number: document.getElementById('d-license-no').value.trim(),
        license_class: document.getElementById('d-license-class').value,
        experience_years: Number(document.getElementById('d-exp-years').value) || 0,
        status: document.getElementById('d-status').value,
      };

      const saveBtn = document.getElementById('btn-save-driver');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      try {
        if (editId) {
          await fetchJson(`${BASE_API}/drivers/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await fetchJson(`${BASE_API}/drivers`, { method: 'POST', body: JSON.stringify(payload) });
        }
        document.getElementById('driver-modal').classList.add('hidden');
        await loadAllData();
      } catch (err) {
        alert(`Lưu hồ sơ tài xế thất bại: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu hồ sơ tài xế';
      }
    });
  });
})();