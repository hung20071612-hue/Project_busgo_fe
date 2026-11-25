document.addEventListener("DOMContentLoaded", async () => {
  const healthDot = document.getElementById("health-dot");
  const healthText = document.getElementById("health-text");
  const searchForm = document.getElementById("quick-search-form");
  const departureInput = document.getElementById("departure-input");
  const arrivalInput = document.getElementById("arrival-input");
  const swapBtn = document.getElementById("btn-swap-stations");
  const dateInput = document.getElementById("departure-date");
  const stationsDatalist = document.getElementById("stations-datalist");
  const routesContainer = document.getElementById("popular-routes-container");

  // Đặt ngày mặc định là hôm nay và chặn chọn ngày quá khứ
  const todayStr = new Date().toISOString().split("T")[0];
  dateInput.value = todayStr;
  dateInput.min = todayStr;

  // Nút đảo chiều điểm đi <-> điểm đến
  swapBtn.addEventListener("click", () => {
    const temp = departureInput.value;
    departureInput.value = arrivalInput.value;
    arrivalInput.value = temp;
  });

  // Kiểm tra kết nối Backend (/api/health)
  async function checkBackendHealth() {
    try {
      await api.get("/health");
      healthDot.className = "health-dot online";
      healthText.textContent = "Hệ thống sẵn sàng";
    } catch {
      healthDot.className = "health-dot offline";
      healthText.textContent = "Mất kết nối Backend";
    }
  }

  // Định dạng tiền VNĐ
  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("vi-VN") + " đ";
  }

  // Đổi phút -> giờ phút (VD: 150 -> 2h30p)
  function formatDuration(minutes) {
    const mins = Number(minutes || 0);
    if (!mins) return "Đang cập nhật";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}p` : `${h} giờ`;
  }

  // Nạp danh sách bến xe & tuyến đường từ API
  let stationMap = new Map();

  async function loadStationsAndRoutes() {
    try {
      const [stationsRes, routesRes] = await Promise.all([
        api.get("/admin/stations").catch(() => []),
        api.get("/admin/routes").catch(() => []),
      ]);

      const stations = Array.isArray(stationsRes) ? stationsRes : stationsRes?.items || [];
      const routes = Array.isArray(routesRes) ? routesRes : routesRes?.items || [];

      // Đổ danh sách bến xe vào datalist gợi ý
      stationsDatalist.innerHTML = "";
      stations.forEach((st) => {
        stationMap.set(st.id, st);
        const opt = document.createElement("option");
        opt.value = st.city ? `${st.name} (${st.city})` : st.name;
        stationsDatalist.appendChild(opt);
      });

      renderPopularRoutes(routes);
    } catch {
      renderPopularRoutes([]);
    }
  }

  function renderPopularRoutes(routes) {
    const activeRoutes = routes.filter((r) => r.is_active !== false).slice(0, 6);

    if (activeRoutes.length === 0) {
      // Fallback tuyến mẫu nếu database chưa có dữ liệu routes
      const fallbackRoutes = [
        { from: "Bến xe Mỹ Đình (Hà Nội)", to: "Bến xe Trung Tâm (Đà Nẵng)", distance: 765, time: 840, price: 420000 },
        { from: "Bến xe Giáp Bát (Hà Nội)", to: "Bến xe Niệm Nghĩa (Hải Phòng)", distance: 105, time: 110, price: 130000 },
        { from: "Bến xe Miền Đông (TP.HCM)", to: "Bến xe Đà Lạt (Lâm Đồng)", distance: 310, time: 390, price: 290000 },
        { from: "Bến xe Mỹ Đình (Hà Nội)", to: "Bến xe Sa Pa (Lào Cai)", distance: 315, time: 330, price: 320000 },
      ];

      routesContainer.innerHTML = fallbackRoutes
        .map(
          (r) => `
          <div class="route-card">
            <div>
              <div class="route-title">${r.from} → ${r.to}</div>
              <div class="route-meta">Quãng đường: ${r.distance} km · Dự kiến: ${formatDuration(r.time)}</div>
            </div>
            <div class="route-price-row">
              <div>
                <span class="muted">Giá từ</span><br>
                <span class="route-price">${formatCurrency(r.price)}</span>
              </div>
              <a
                href="pages/trips.html?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&date=${todayStr}"
                class="btn btn-primary btn-small"
              >
                Chọn tuyến
              </a>
            </div>
          </div>
        `
        )
        .join("");
      return;
    }

    routesContainer.innerHTML = activeRoutes
      .map((route) => {
        const dep = stationMap.get(route.departure_id);
        const arr = stationMap.get(route.arrival_id);
        const fromLabel = dep ? (dep.city ? `${dep.name} (${dep.city})` : dep.name) : `Bến #${route.departure_id}`;
        const toLabel = arr ? (arr.city ? `${arr.name} (${arr.city})` : arr.name) : `Bến #${route.arrival_id}`;

        return `
          <div class="route-card">
            <div>
              <span class="badge badge-user" style="margin-bottom: 6px;">${route.code}</span>
              <div class="route-title">${fromLabel} → ${toLabel}</div>
              <div class="route-meta">
                Quãng đường: ${route.distance_km} km · Dự kiến: ${formatDuration(route.estimated_time)}
              </div>
            </div>
            <div class="route-price-row">
              <div>
                <span class="muted">Giá vé cơ bản</span><br>
                <span class="route-price">${formatCurrency(route.base_price)}</span>
              </div>
              <a
                href="pages/trips.html?route_id=${route.id}&from=${encodeURIComponent(fromLabel)}&to=${encodeURIComponent(toLabel)}&date=${todayStr}"
                class="btn btn-primary btn-small"
              >
                Tìm chuyến
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Xử lý submit form tìm kiếm nhanh -> chuyển sang pages/trips.html
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fromVal = departureInput.value.trim();
    const toVal = arrivalInput.value.trim();
    const dateVal = dateInput.value;

    const query = new URLSearchParams({
      from: fromVal,
      to: toVal,
      date: dateVal,
    });
    window.location.href = `pages/trips.html?${query.toString()}`;
  });

  await Promise.all([checkBackendHealth(), loadStationsAndRoutes()]);
});