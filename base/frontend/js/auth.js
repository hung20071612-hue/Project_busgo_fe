// Xử lý form Đăng nhập Khách hàng, Đăng nhập Admin và Đăng ký tài khoản

function showAuthAlert(elementId, message, type = "error") {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = message;
  box.className = `alert alert-${type} show`;
}

// Ẩn / hiện mật khẩu
document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "Ẩn" : "Hiện";
  });
});

// 1. Đăng nhập Khách hàng (login.html)
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  redirectIfAuthenticated();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("loginSubmitBtn");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang đăng nhập...";

    try {
      const loginData = await api.post("/auth/login", { email, password });
      authStorage.setToken(loginData.access_token);

      const user = await api.get("/users/me");
      authStorage.setUser(user);

      window.location.href = `${getRootPath()}index.html`;
    } catch (error) {
      authStorage.clear();
      showAuthAlert("authAlert", error.message || "Đăng nhập thất bại", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng nhập";
    }
  });
}

// 2. Đăng nhập riêng cho Admin / Nhân viên (admin/login.html)
const adminLoginForm = document.getElementById("adminLoginForm");
if (adminLoginForm) {
  redirectIfAdminAuthenticated();

  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("adminLoginSubmitBtn");
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang xác thực quyền quản trị...";

    try {
      const loginData = await api.post("/auth/login", { email, password });
      authStorage.setToken(loginData.access_token);

      const user = await api.get("/users/me");
      const role = String(user.role || "").toUpperCase();

      if (role !== "ADMIN" && role !== "STAFF") {
        authStorage.clear();
        showAuthAlert(
          "adminAuthAlert",
          "Tài khoản khách hàng không có quyền truy cập cổng Quản trị!",
          "error"
        );
        return;
      }

      authStorage.setUser(user);
      window.location.href = `${getRootPath()}admin/dashboard.html`;
    } catch (error) {
      authStorage.clear();
      showAuthAlert("adminAuthAlert", error.message || "Đăng nhập quản trị thất bại", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng nhập vào Quản trị";
    }
  });
}

// 3. Đăng ký Khách hàng (register.html)
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  redirectIfAuthenticated();

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("registerSubmitBtn");
    const full_name = document.getElementById("regFullName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (full_name.length < 5) {
      showAuthAlert("authAlert", "Họ và tên phải có ít nhất 5 ký tự", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      showAuthAlert("authAlert", "Số điện thoại phải gồm đúng 10 chữ số", "error");
      return;
    }
    if (password !== confirmPassword) {
      showAuthAlert("authAlert", "Mật khẩu xác nhận không khớp", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang tạo tài khoản...";

    try {
      await api.post("/auth/register", { full_name, email, phone, password });
      showAuthAlert(
        "authAlert",
        "Đăng ký thành công! Đang chuyển sang trang đăng nhập...",
        "success"
      );
      setTimeout(() => {
        window.location.href = `${getRootPath()}login.html`;
      }, 1200);
    } catch (error) {
      showAuthAlert("authAlert", error.message || "Đăng ký thất bại", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng ký tài khoản";
    }
  });
}