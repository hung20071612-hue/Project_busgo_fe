// Module gọi API bằng axios: cấu hình 1 lần, mọi trang dùng chung.
// Thứ tự nạp script: axios -> config.js -> api.js -> auth.js -> layout.js -> js/pages/*.js

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status; // Mã HTTP: 400, 401, 404, 422, 500... (0 = lỗi mạng)
    this.data = data;
  }
}

const http = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Tự động gắn JWT Bearer Token vào mọi request nếu đã đăng nhập
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY) || localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chuyển đổi thông báo lỗi từ FastAPI sang chuỗi dễ đọc
function getErrorMessage(data, status) {
  if (data && typeof data.detail === "string") {
    return data.detail;
  }
  if (data && Array.isArray(data.detail)) {
    const fieldLabels = {
      full_name: "Họ và tên",
      email: "Email",
      phone: "Số điện thoại",
      password: "Mật khẩu",
    };
    return data.detail
      .map((err) => {
        const rawField = err.loc?.[err.loc.length - 1] || "";
        const label = fieldLabels[rawField] || rawField;
        return label ? `${label}: ${err.msg}` : err.msg;
      })
      .join("; ");
  }
  if (status === 429) {
    return "Bạn thao tác quá nhanh, vui lòng thử lại sau 1 phút.";
  }
  return `Lỗi hệ thống (${status})`;
}

// Bắt lỗi tập trung: xử lý 401 hết hạn phiên & chuẩn hóa ApiError
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Nếu token không hợp lệ hoặc hết hạn trên các trang cần xác thực
      if (status === 401) {
        const isAuthPage =
          window.location.pathname.endsWith("/login.html") ||
          window.location.pathname.endsWith("/register.html");

        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem("token");
        localStorage.removeItem(CONFIG.USER_KEY);

        if (!isAuthPage) {
          const root = document.body?.dataset?.root || "./";
          const currentUrl = encodeURIComponent(window.location.href);
          window.location.href = `${root}pages/login.html?redirect=${currentUrl}`;
        }
      }

      return Promise.reject(new ApiError(getErrorMessage(data, status), status, data));
    }

    return Promise.reject(
      new ApiError(
        "Không kết nối được backend. Hãy kiểm tra server FastAPI tại " + CONFIG.API_BASE_URL,
        0
      )
    );
  }
);

const api = {
  get: (path, params) => http.get(path, { params }).then((res) => res.data),
  post: (path, body) => http.post(path, body).then((res) => res.data),
  put: (path, body) => http.put(path, body).then((res) => res.data),
  patch: (path, body) => http.patch(path, body).then((res) => res.data),
  delete: (path) => http.delete(path).then((res) => res.data),
};