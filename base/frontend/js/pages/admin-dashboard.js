(() => {
  const BASE_API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
    ? API_BASE_URL
    : 'http://127.0.0.1:8000/api';

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

  function getId(obj, altKey) {
    return obj?.id ?? obj?.[altKey] ?? null;
  }

  async function safeFetchList(endpoint) {
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BASE_API}${endpoint}`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      return data.items || data.data || data.bookings || data.trips || data.routes || data.users || [];
    } catch (_) {
      return [];
    }
  }

  function renderAdminName() {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u && (u.full_name || u.name || u.email)) {
        document.getElementById('admin-display-name').textContent = u.full_name || u.name || u.email;
      }
    } catch (_) {}
  }

  function getStatusBadge(status) {
    const st = String(status || '').toUpperCase();
    if (st === 'PAID' || st === 'CONFIRMED') {
      return `<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">Đã thanh toán</span>`;
    }
    if (st === 'PENDING_PAYMENT' || st === 'PENDING') {
      return `<span class="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">Chờ thanh toán</span>`;
    }
    return `<span class="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">Đã hủy</span>`;
  }

  async function loadDashboard() {
    const [bookings, trips, routes, users] = await Promise.all([
      safeFetchList('/bookings'),
      safeFetchList('/trips'),
      safeFetchList('/routes'),
      safeFetchList('/users'),
    ]);

    // Map tra cứu nhanh Route & Trip
    const routeMap = new Map();
    routes.forEach((r) => routeMap.set(String(getId(r, 'route_id')), r));

    const tripMap = new Map();
    trips.forEach((t) => tripMap.set(String(getId(t, 'trip_id')), t));

    // 1. Tính KPI
    let paidRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    bookings.forEach((b) => {
      const st = String(b.status || '').toUpperCase();
      const amount = Number(b.total_amount ?? b.total_price ?? 0);
      if (st === 'PAID' || st === 'CONFIRMED') {
        paidRevenue += amount;
        paidCount += 1;
      } else if (st === 'PENDING_PAYMENT' || st === 'PENDING') {
        pendingCount += 1;
      } else if (st === 'CANCELLED') {
        cancelledCount += 1;
      }
    });

    document.getElementById('kpi-revenue').textContent = formatVND(paidRevenue);
    document.getElementById('kpi-revenue-sub').textContent = `Từ ${paidCount} đơn đã thanh toán thành công`;
    document.getElementById('kpi-bookings').textContent = bookings.length;
    document.getElementById('kpi-bookings-sub').textContent = `${pendingCount} chờ thanh toán • ${cancelledCount} đã hủy`;
    document.getElementById('kpi-trips').textContent = `${trips.length} chuyến`;
    document.getElementById('kpi-routes-sub').textContent = `Trên ${routes.length} tuyến đường khai thác`;
    document.getElementById('kpi-users').textContent = users.length || '---';
    document.getElementById('last-updated').textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;

    // 2. Hiệu suất doanh thu theo tuyến
    const routeRevenue = new Map();
    bookings.forEach((b) => {
      const st = String(b.status || '').toUpperCase();
      if (st !== 'PAID' && st !== 'CONFIRMED') return;
      const trip = tripMap.get(String(b.trip_id)) || b.trip || {};
      const route = routeMap.get(String(trip.route_id)) || {};
      const label = (trip.origin && trip.destination)
        ? `${trip.origin} → ${trip.destination}`
        : (route.origin && route.destination ? `${route.origin} → ${route.destination}` : `Chuyến #${b.trip_id || '?'}`);
      const prev = routeRevenue.get(label) || { total: 0, count: 0 };
      prev.total += Number(b.total_amount ?? b.total_price ?? 0);
      prev.count += 1;
      routeRevenue.set(label, prev);
    });

    const perfEl = document.getElementById('route-performance-list');
    const sortedPerf = Array.from(routeRevenue.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    if (sortedPerf.length === 0) {
      perfEl.innerHTML = `<p class="text-sm text-slate-400 py-4">Chưa có dữ liệu doanh thu theo tuyến.</p>`;
    } else {
      const maxVal = sortedPerf[0][1].total || 1;
      perfEl.innerHTML = sortedPerf.map(([name, info]) => {
        const pct = Math.max(8, Math.round((info.total / maxVal) * 100));
        return `
          <div>
            <div class="flex items-center justify-between text-sm mb-1.5">
              <span class="font-semibold text-slate-800">${name} <span class="text-xs font-normal text-slate-400">(${info.count} vé)</span></span>
              <span class="font-display font-bold text-brand-600">${formatVND(info.total)}</span>
            </div>
            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-brand-500 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Chuyến xe sắp khởi hành
    const upcomingEl = document.getElementById('upcoming-trips-list');
    const sortedTrips = [...trips]
      .sort((a, b) => new Date(a.departure_time || 0) - new Date(b.departure_time || 0))
      .slice(0, 4);

    if (sortedTrips.length === 0) {
      upcomingEl.innerHTML = `<p class="text-sm text-slate-400 py-4">Chưa có lịch chuyến xe nào.</p>`;
    } else {
      upcomingEl.innerHTML = sortedTrips.map((t) => {
        const r = routeMap.get(String(t.route_id)) || {};
        const origin = t.origin || r.origin || 'Điểm đi';
        const dest = t.destination || r.destination || 'Điểm đến';
        const price = formatVND(t.price ?? t.ticket_price ?? r.base_price ?? 0);
        return `
          <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <div class="font-semibold text-sm text-slate-900">${origin} → ${dest}</div>
              <div class="text-xs text-slate-500 mt-0.5">${formatDateTimeVN(t.departure_time)}</div>
            </div>
            <div class="text-right">
              <div class="font-display font-bold text-sm text-brand-600">${price}</div>
              <a href="staff-passengers.html" class="text-[11px] font-medium text-slate-500 hover:text-brand-600">Soát vé →</a>
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. Bảng 10 đơn đặt vé gần đây
    const tbody = document.getElementById('recent-bookings-tbody');
    const recent = [...bookings]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Chưa có giao dịch đặt vé nào.</td></tr>`;
    } else {
      tbody.innerHTML = recent.map((b) => {
        const bId = getId(b, 'booking_id');
        const code = b.booking_code || `BG${String(bId).padStart(4, '0')}`;
        const trip = tripMap.get(String(b.trip_id)) || b.trip || {};
        const route = routeMap.get(String(trip.route_id)) || {};
        const routeLabel = (trip.origin && trip.destination)
          ? `${trip.origin} → ${trip.destination}`
          : (route.origin && route.destination ? `${route.origin} → ${route.destination}` : `Chuyến #${b.trip_id || '---'}`);

        return `
          <tr class="hover:bg-slate-50/80">
            <td class="px-5 py-3.5 font-mono text-xs font-bold text-slate-800">#${code}</td>
            <td class="px-5 py-3.5 font-medium text-slate-800">${routeLabel}</td>
            <td class="px-5 py-3.5 text-slate-500 text-xs">${formatDateTimeVN(b.created_at)}</td>
            <td class="px-5 py-3.5 font-semibold text-slate-900">${formatVND(b.total_amount ?? b.total_price ?? 0)}</td>
            <td class="px-5 py-3.5">${getStatusBadge(b.status)}</td>
            <td class="px-5 py-3.5 text-right">
              <a href="booking-detail.html?id=${bId}" class="text-xs font-semibold text-brand-600 hover:underline">Xem vé</a>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderAdminName();
    loadDashboard();
    document.getElementById('btn-reload-dashboard').addEventListener('click', loadDashboard);
  });
})();