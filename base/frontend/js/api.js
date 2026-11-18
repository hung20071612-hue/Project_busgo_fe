// Module gọi API bằng axios: cấu hình 1 lần, mọi trang dùng chung.
// (axios được nạp từ CDN bằng thẻ <script> trước file này, sau js/config.js)

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status; // mã HTTP: 401, 403, 404, 422, 500... (0 = không gọi được server)
    this.data = data; // nội dung lỗi gốc server trả về
  }
}

// Quản lý lưu trữ Token & thông tin User hiện tại
const authStorage = {
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
  },
  getUser() {
    const raw = localStorage.getItem(CONFIG.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },
};

function getRootPath() {
  return document.body?.dataset?.root || (window.location.pathname.includes("/admin/") ? "../" : "./");
}

function getLoginUrl() {
  const root = getRootPath();
  const isAdminArea =
    document.body?.dataset?.layout === "admin" || window.location.pathname.includes("/admin/");
  return isAdminArea ? `${root}admin/login.html` : `${root}login.html`;
}

function logoutUser() {
  const loginUrl = getLoginUrl();
  authStorage.clear();
  window.location.href = loginUrl;
}

// Instance axios dùng chung: mọi request tự nối thêm baseURL phía trước
const http = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Request Interceptor: tự động gửi kèm Bearer Token cho mọi request
http.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Lấy câu thông báo lỗi dễ đọc (hỗ trợ cả format FastAPI mặc định và global_exception_handler)
function getErrorMessage(data, status) {
  if (!data) return `Lỗi ${status}`;
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.detail === "string" && data.detail) return data.detail;

  const errorList = Array.isArray(data.details)
    ? data.details
    : Array.isArray(data.detail)
      ? data.detail
      : null;

  if (errorList) {
    return errorList
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : "";
        return field ? `${field}: ${e.msg}` : e.msg;
      })
      .join("; ");
  }
  return `Lỗi ${status}`;
}

// Response Interceptor: xử lý lỗi 401/403 tập trung và đổi lỗi axios thành ApiError
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = getErrorMessage(data, status);
      const requestUrl = error.config?.url || "";

      // Token hết hạn hoặc không hợp lệ -> xóa phiên và đẩy về đúng trang đăng nhập
      if (status === 401 && !requestUrl.includes("/auth/login")) {
        authStorage.clear();
        window.location.href = getLoginUrl();
      }

      // Tài khoản bị khóa -> đăng xuất bắt buộc
      if (status === 403 && message.toLowerCase().includes("khóa")) {
        authStorage.clear();
        alert(message);
        window.location.href = getLoginUrl();
      }

      return Promise.reject(new ApiError(message, status, data));
    }

    return Promise.reject(
      new ApiError(
        "Không kết nối được backend. Backend đã chạy chưa? Kiểm tra CONFIG.API_BASE_URL.",
        0
      )
    );
  }
);

const api = {
  get: (path, params) => http.get(path, { params }).then((res) => res.data),
  post: (path, body) => http.post(path, body).then((res) => res.data),
  put: (path, body) => http.put(path, body).then((res) => res.data),
  delete: (path) => http.delete(path).then((res) => res.data),
};