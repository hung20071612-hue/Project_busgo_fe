// Layout dùng chung cho toàn dự án:
// 1. Layout Khách hàng: dùng <body data-root="./"> với <header id="app-header"> và <footer id="app-footer">
// 2. Layout Admin:      dùng <body data-root="../" data-layout="admin" data-menu="dashboard" data-title="...">
//                       với <aside id="admin-sidebar"> và <header id="admin-topbar">

const CUSTOMER_MENU = [
  { href: "index.html", label: "Vé xe khách", roles: ["GUEST", "USER", "STAFF", "ADMIN"] },
  { href: "pages/lookup.html", label: "Tra cứu vé", roles: ["GUEST", "USER", "STAFF", "ADMIN"] },
  { href: "pages/my-bookings.html", label: "Vé của tôi", roles: ["USER", "STAFF", "ADMIN"] },
  { href: "admin/dashboard.html", label: "Trang Quản Trị", roles: ["STAFF", "ADMIN"], isBadge: true },
];

const ADMIN_MENU = [
  { section: "Vận hành" },
  { key: "dashboard", href: "admin/dashboard.html", label: "Tổng quan", roles: ["ADMIN", "STAFF"] },
  { key: "trips", href: "admin/trips.html", label: "Quản lý Chuyến xe", roles: ["ADMIN", "STAFF"] },
  { key: "bookings", href: "admin/bookings.html", label: "Quản lý Đặt vé", roles: ["ADMIN", "STAFF"] },
  { section: "Danh mục hệ thống", roles: ["ADMIN"] },
  { key: "stations", href: "admin/stations.html", label: "Quản lý Bến xe", roles: ["ADMIN"] },
  { key: "routes", href: "admin/routes.html", label: "Quản lý Tuyến đường", roles: ["ADMIN"] },
  { key: "buses", href: "admin/buses.html", label: "Quản lý Xe & Loại xe", roles: ["ADMIN"] },
  { key: "drivers", href: "admin/drivers.html", label: "Quản lý Tài xế", roles: ["ADMIN"] },
  { key: "users", href: "admin/users.html", label: "Quản lý Tài khoản", roles: ["ADMIN"] },
];

function renderCustomerLayout() {
  const root = getRootPath();
  const currentPath = window.location.pathname;
  const user = authStorage.getUser();
  const currentRole = user ? String(user.role || "USER").toUpperCase() : "GUEST";

  const headerEl = document.getElementById("app-header");
  if (headerEl) {
    const navLinks = CUSTOMER_MENU.filter((item) => item.roles.includes(currentRole))
      .map((item) => {
        const isActive =
          currentPath.endsWith("/" + item.href) ||
          (item.href === "index.html" && (currentPath.endsWith("/") || currentPath.endsWith("/index.html")));
        const extraClass = item.isBadge ? "cust-nav-admin" : `cust-nav-link ${isActive ? "active" : ""}`;
        return `<a href="${root}${item.href}" class="${extraClass}">${item.label}</a>`;
      })
      .join("");

    const safeName = typeof escapeHtml === "function" ? escapeHtml(user?.full_name) : (user?.full_name || "");
    const initial = (user?.full_name || "U").trim().charAt(0).toUpperCase();

    const accountArea = user
      ? `
        <div class="user-pill">
          <span class="user-avatar">${initial}</span>
          <span>${safeName}</span>
        </div>
        <button type="button" class="btn-logout" onclick="logoutUser()">Đăng xuất</button>
      `
      : `
        <a href="${root}login.html" class="btn btn-outline">Đăng nhập</a>
        <a href="${root}register.html" class="btn btn-primary">Đăng ký</a>
      `;

    headerEl.innerHTML = `
      <div class="container cust-header-inner">
        <a href="${root}index.html" class="cust-brand">
          <span class="cust-brand-icon">BUSGO</span>
          <span>${CONFIG.APP_NAME}</span>
        </a>
        <nav class="cust-nav">${navLinks}</nav>
        <div class="cust-actions">${accountArea}</div>
      </div>
    `;
  }

  const footerEl = document.getElementById("app-footer");
  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">${CONFIG.APP_NAME} Vietnam</div>
            <p>Nền tảng đặt vé xe khách trực tuyến nhanh chóng, chọn ghế trực quan và thanh toán an toàn.</p>
          </div>
          <div class="footer-col">
            <h4>Tuyến phổ biến</h4>
            <ul>
              <li><a href="${root}index.html">Vé xe đi Hà Nội</a></li>
              <li><a href="${root}index.html">Hà Nội - Hải Phòng</a></li>
              <li><a href="${root}index.html">Hà Nội - Sa Pa</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Hỗ trợ khách hàng</h4>
            <ul>
              <li><a href="${root}pages/lookup.html">Tra cứu mã đặt vé</a></li>
              <li><a href="#">Chính sách đổi & hủy vé</a></li>
              <li><a href="#">Câu hỏi thường gặp</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Cổng truy cập</h4>
            <ul>
              <li><a href="${root}login.html">Đăng nhập Khách hàng</a></li>
              <li><a href="${root}register.html">Đăng ký thành viên</a></li>
              <li><a href="${root}admin/login.html">Cổng Quản trị (Admin)</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} ${CONFIG.APP_NAME} - Nhóm 5 · Hệ thống đặt vé xe khách trực tuyến</div>
      </div>
    `;
  }
}

function renderAdminLayout(activeMenuOverride, pageTitleOverride) {
  const user = requireRole(["ADMIN", "STAFF"]);
  if (!user) return;

  const root = getRootPath();
  const role = String(user.role || "").toUpperCase();
  const activeMenu = activeMenuOverride || document.body.dataset.menu || "dashboard";
  const pageTitle = pageTitleOverride || document.body.dataset.title || "Quản trị hệ thống";

  const sidebarEl = document.getElementById("admin-sidebar");
  if (sidebarEl) {
    const menuHtml = ADMIN_MENU.filter((item) => !item.roles || item.roles.includes(role))
      .map((item) => {
        if (item.section) {
          return `<div class="sidebar-section">${item.section}</div>`;
        }
        const isActive = activeMenu === item.key ? "active" : "";
        return `<a href="${root}${item.href}" class="sidebar-link ${isActive}">${item.label}</a>`;
      })
      .join("");

    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <span class="sidebar-badge">BUSGO</span>
        <span>Quản Trị Viên</span>
      </div>
      <nav class="sidebar-menu">${menuHtml}</nav>
      <div class="sidebar-footer">
        <a href="${root}index.html" class="sidebar-link">← Về trang Khách hàng</a>
      </div>
    `;
  }

  const topbarEl = document.getElementById("admin-topbar");
  if (topbarEl) {
    const safeName = typeof escapeHtml === "function" ? escapeHtml(user.full_name) : user.full_name;
    topbarEl.innerHTML = `
      <h1 class="admin-page-title">${pageTitle}</h1>
      <div class="admin-user-box">
        <span class="role-chip">${role}</span>
        <strong>${safeName}</strong>
        <button type="button" class="btn-logout" onclick="logoutUser()">Đăng xuất</button>
      </div>
    `;
  }
}

function renderLayout() {
  if (document.body?.dataset?.layout === "admin") {
    renderAdminLayout();
  } else {
    renderCustomerLayout();
  }
}

renderLayout();