// Cấu hình chung của frontend.
// Mặc định gọi backend trên cùng hostname với frontend, tránh lỗi khi mở FE
// bằng localhost nhưng API lại cấu hình cứng thành 127.0.0.1 (hoặc ngược lại).
// Có thể ghi đè API bằng ?api=http://host:8000/api khi cần.
const apiOverride = new URLSearchParams(window.location.search).get("api");
const apiHost = window.location.hostname || "127.0.0.1";
const CONFIG = {
  API_BASE_URL: apiOverride || `${window.location.protocol === "https:" ? "https:" : "http:"}//${apiHost}:8000/api`,
  APP_NAME: "KS25 Base",
};
