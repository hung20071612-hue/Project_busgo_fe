document.addEventListener("DOMContentLoaded", () => {
  // Nếu đã đăng nhập rồi thì chuyển về trang chủ
  Auth.redirectIfAuthenticated();

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const togglePassBtn = document.getElementById("toggle-password");
  const alertBox = document.getElementById("login-alert");
  const submitBtn = document.getElementById("btn-submit");

  // Hiển thị thông báo nếu vừa đăng ký thành công từ register.html
  const params = new URLSearchParams(window.location.search);
  if (params.get("registered") === "1") {
    const prefillEmail = params.get("email");
    if (prefillEmail) emailInput.value = prefillEmail;
    showAlert("Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.", "status-ok");
  }

  function showAlert(message, typeClass) {
    alertBox.textContent = message;
    alertBox.className = `status ${typeClass}`;
  }

  togglePassBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassBtn.textContent = isHidden ? "Ẩn" : "Hiện";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert("Vui lòng nhập đầy đủ Email và Mật khẩu.", "status-error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang đăng nhập...";
    alertBox.className = "status";
    alertBox.textContent = "";

    try {
      const { user } = await Auth.login(email, password);
      showAlert(`Xin chào ${user?.full_name || email}! Đang chuyển hướng...`, "status-ok");

      const redirectTarget = params.get("redirect");
      setTimeout(() => {
        if (redirectTarget) {
          window.location.href = decodeURIComponent(redirectTarget);
        } else if (user?.role?.toUpperCase() === "ADMIN") {
          window.location.href = "../pages/admin-dashboard.html";
        } else {
          window.location.href = "../index.html";
        }
      }, 500);
    } catch (err) {
      showAlert(err.message || "Đăng nhập thất bại.", "status-error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng nhập";
    }
  });
});