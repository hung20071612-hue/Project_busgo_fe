// Quản lý phiên đăng nhập, thông tin người dùng (/users/me) và phân quyền BusGo
const Auth = {
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY) || localStorage.getItem("token");
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
      localStorage.setItem("token", token); // Tương thích ngược nếu module khác dùng key "token"
    } else {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem("token");
    }
  },

  getUser() {
    try {
      const raw = localStorage.getItem(CONFIG.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CONFIG.USER_KEY);
    }
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  getRole() {
    const user = this.getUser();
    return (user?.role || "GUEST").toUpperCase();
  },

  // Lấy thông tin tài khoản hiện tại từ GET /api/users/me
  async fetchCurrentUser() {
    if (!this.getToken()) return null;
    try {
      const user = await api.get("/users/me");
      this.setUser(user);
      return user;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        this.clearSession();
      }
      return null;
    }
  },

  // Đăng nhập: POST /api/auth/login -> lưu token -> gọi /api/users/me
  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    this.setToken(res.access_token);
    const user = await this.fetchCurrentUser();
    return { token: res.access_token, user };
  },

  // Đăng ký: POST /api/auth/register
  async register({ full_name, email, phone, password }) {
    return await api.post("/auth/register", {
      full_name,
      email,
      phone,
      password,
    });
  },

  clearSession() {
    this.setToken(null);
    this.setUser(null);
  },

  logout(redirect = true) {
    this.clearSession();
    if (redirect) {
      const root = document.body?.dataset?.root || "./";
      window.location.href = `${root}pages/login.html`;
    }
  },

  // Chặn trang yêu cầu đăng nhập hoặc yêu cầu vai trò cụ thể (VD: ["ADMIN"])
  requireAuth(allowedRoles = []) {
    const root = document.body?.dataset?.root || "./";
    if (!this.isAuthenticated()) {
      const redirectUrl = encodeURIComponent(window.location.href);
      window.location.href = `${root}pages/login.html?redirect=${redirectUrl}`;
      return false;
    }

    if (allowedRoles.length > 0) {
      const currentRole = this.getRole();
      const normalized = allowedRoles.map((r) => r.toUpperCase());
      if (!normalized.includes(currentRole)) {
        window.location.href = `${root}index.html`;
        return false;
      }
    }
    return true;
  },

  // Chuyển về trang chủ nếu đã đăng nhập mà vẫn vào login/register
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      const root = document.body?.dataset?.root || "./";
      window.location.href = `${root}index.html`;
    }
  },
};