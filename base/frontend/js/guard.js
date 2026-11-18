// Bảo vệ các trang yêu cầu đăng nhập hoặc phân quyền theo Role (USER, STAFF, ADMIN)

function requireAuth() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (!token || !user) {
    window.location.href = `${getRootPath()}login.html`;
    return null;
  }
  return user;
}

function requireRole(allowedRoles = []) {
  const root = getRootPath();
  const token = authStorage.getToken();
  const user = authStorage.getUser();

  if (!token || !user) {
    window.location.href = `${root}admin/login.html`;
    return null;
  }

  const userRole = String(user.role || "").toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (!normalizedAllowed.includes(userRole)) {
    alert("Bạn không có quyền truy cập khu vực quản trị!");
    window.location.href = `${root}index.html`;
    return null;
  }
  return user;
}

function redirectIfAuthenticated() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (token && user) {
    window.location.href = `${getRootPath()}index.html`;
  }
}

function redirectIfAdminAuthenticated() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (token && user) {
    const role = String(user.role || "").toUpperCase();
    if (role === "ADMIN" || role === "STAFF") {
      window.location.href = `${getRootPath()}admin/dashboard.html`;
    }
  }
}