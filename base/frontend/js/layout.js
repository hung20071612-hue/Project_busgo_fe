// Layout chung: tự động render Header (phân quyền theo role) và Footer cho mọi trang.
// Yêu cầu thẻ <body data-root="./"> (ở thư mục gốc) hoặc <body data-root="../"> (trong pages/)

function getMenuByRole(role) {
  const menu = [
    { href: "index.html", label: "Trang chủ" },
    { href: "pages/trips.html", label: "Tìm chuyến xe" },
  ];

  if (role === "USER" || role === "CUSTOMER") {
    menu.push(
      { href: "pages/my-bookings.html", label: "Vé của tôi" },
      { href: "pages/profile.html", label: "Tài khoản" }
    );
  } else if (role === "STAFF") {
    menu.push(
      { href: "pages/staff-checkin.html", label: "Soát vé / Check-in" },
      { href: "pages/profile.html", label: "Tài khoản" }
    );
  } else if (role === "ADMIN") {
    menu.push(
      { href: "pages/admin-dashboard.html", label: "Dashboard" },
      { href: "pages/admin-routes.html", label: "Tuyến & Bến" },
      { href: "pages/admin-trips.html", label: "Chuyến xe" },
      { href: "pages/admin-seat-maps.html", label: "Loại xe & Ghế" },
      { href: "pages/admin-users.html", label: "Người dùng" }
    );
  }

  // Loại bỏ mục trùng theo href để đảm bảo mỗi mục chỉ xuất hiện 1 lần
  const seen = new Set();
  return menu.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function getRoleBadgeClass(role) {
  if (role === "ADMIN") return "badge-admin";
  if (role === "STAFF") return "badge-staff";
  return "badge-user";
}

function getInitials(fullName) {
  if (!fullName) return "U";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].charAt(0).toUpperCase();
}

function renderLayout() {
  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;
  const isLoggedIn = typeof Auth !== "undefined" && Auth.isAuthenticated();
  const user = isLoggedIn ? Auth.getUser() : null;
  const role = isLoggedIn ? Auth.getRole() : "GUEST";

  const menuItems = getMenuByRole(role);
  const navHtml = menuItems
    .map((item) => {
      const isActive =
        currentPath.endsWith("/" + item.href) ||
        (item.href === "index.html" &&
          (currentPath.endsWith("/") || currentPath.endsWith("/index.html")));
      return `<a href="${root}${item.href}" class="${isActive ? "active" : ""}">${item.label}</a>`;
    })
    .join("");

  let authHtml = "";
  if (isLoggedIn) {
    const displayName = user?.full_name || user?.email || "Thành viên";
    authHtml = `
      <div class="header-auth">
        <a href="${root}pages/profile.html" class="user-chip" title="Xem hồ sơ cá nhân">
          <span class="user-avatar">${getInitials(displayName)}</span>
          <span>${displayName}</span>
          <span class="badge ${getRoleBadgeClass(role)}">${role}</span>
        </a>
        <button type="button" id="btn-header-logout" class="btn btn-small btn-danger">Đăng xuất</button>
      </div>
    `;
  } else {
    authHtml = `
      <div class="header-auth">
        <a href="${root}pages/login.html" class="btn btn-small">Đăng nhập</a>
        <a href="${root}pages/register.html" class="btn btn-small btn-primary">Đăng ký</a>
      </div>
    `;
  }

  const headerEl = document.getElementById("app-header");
  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container header-inner">
        <a href="${root}index.html" class="brand">
          <img src="${root}assets/images/logo.svg" alt="BusGo Logo" width="30" height="30" onerror="this.style.display='none'">
          <span>${CONFIG.APP_NAME}</span>
          <span class="brand-badge">Vé xe trực tuyến</span>
        </a>
        <nav class="nav">${navHtml}</nav>
        ${authHtml}
      </div>
    `;

    const logoutBtn = document.getElementById("btn-header-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => Auth.logout(true));
    }
  }

  const footerEl = document.getElementById("app-footer");
  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container footer-inner">
        <div>© ${new Date().getFullYear()} <strong>${CONFIG.APP_NAME}</strong> · Hệ thống đặt vé xe khách trực tuyến</div>
        <div class="footer-links">
          <a href="${root}index.html">Trang chủ</a>
          <a href="${root}pages/trips.html">Tìm chuyến xe</a>
          <a href="${root}pages/my-bookings.html">Vé của tôi</a>
          <a href="${root}pages/profile.html">Tài khoản</a>
        </div>
      </div>
    `;
  }
}

// Render ngay lập tức từ localStorage để không bị chớp giao diện
renderLayout();

// Đồng bộ role/user mới nhất từ /users/me nếu đã đăng nhập
if (typeof Auth !== "undefined" && Auth.isAuthenticated()) {
  Auth.fetchCurrentUser().then((freshUser) => {
    if (freshUser) renderLayout();
  });
}