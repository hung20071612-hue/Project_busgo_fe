// Bảo vệ các trang yêu cầu đăng nhập hoặc phân quyền theo Role (USER, STAFF, ADMIN)

function requireAuth() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (!token || !user) {
    window.location.replace(`${getRootPath()}admin-login.html`);
    return null;
  }
  return user;
}

function requireRole(allowedRoles = []) {
  const root = getRootPath();
  const token = authStorage.getToken();
  const user = authStorage.getUser();

  if (!token || !user) {
    window.location.replace(`${root}admin/admin-login.html`);
    return null;
  }

  const userRole = String(user.role || "").toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (!normalizedAllowed.includes(userRole)) {
    alert("Bạn không có quyền truy cập khu vực quản trị!");
    window.location.replace(`${root}index.html`);
    return null;
  }

  // Xác thực lại token với backend; nếu token đã hết hạn, interceptor 401 tự đẩy về admin/login.html
  if (typeof api !== "undefined") {
    api.get("/users/me")
      .then((freshUser) => authStorage.setUser(freshUser))
      .catch(() => {});
  }

  return user;
}

function redirectIfAuthenticated() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (token && user) {
    window.location.replace(`${getRootPath()}index.html`);
  }
}

function redirectIfAdminAuthenticated() {
  const token = authStorage.getToken();
  const user = authStorage.getUser();
  if (token && user) {
    const role = String(user.role || "").toUpperCase();
    if (role === "ADMIN" || role === "STAFF") {
      window.location.replace(`${getRootPath()}admin/dashboard.html`);
    }
  }
}