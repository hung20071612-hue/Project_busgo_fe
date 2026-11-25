document.addEventListener("DOMContentLoaded", () => {
  Auth.redirectIfAuthenticated();

  const form = document.getElementById("register-form");
  const fullNameInput = document.getElementById("full_name");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm_password");
  const togglePassBtn = document.getElementById("toggle-password");
  const alertBox = document.getElementById("register-alert");
  const submitBtn = document.getElementById("btn-submit");

  function showAlert(message, typeClass) {
    alertBox.textContent = message;
    alertBox.className = `status ${typeClass}`;
  }

  togglePassBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassBtn.textContent = isHidden ? "Ẩn" : "Hiện";
  });

  // Chỉ cho phép nhập số ở ô điện thoại
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const full_name = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validate phía client khớp RegisterRequest (min_length=5, phone=10 digits)
    if (full_name.length < 5) {
      showAlert("Họ và tên phải có ít nhất 5 ký tự.", "status-error");
      fullNameInput.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert("Địa chỉ email không hợp lệ.", "status-error");
      emailInput.focus();
      return;
    }

    if (!/^0\d{9}$/.test(phone)) {
      showAlert("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.", "status-error");
      phoneInput.focus();
      return;
    }

    if (password.length < 6) {
      showAlert("Mật khẩu phải có ít nhất 6 ký tự.", "status-error");
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Mật khẩu xác nhận không khớp.", "status-error");
      confirmPasswordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang tạo tài khoản...";
    alertBox.className = "status";
    alertBox.textContent = "";

    try {
      await Auth.register({ full_name, email, phone, password });
      showAlert("Đăng ký thành công! Đang chuyển sang trang đăng nhập...", "status-ok");

      setTimeout(() => {
        window.location.href = `login.html?registered=1&email=${encodeURIComponent(email)}`;
      }, 700);
    } catch (err) {
      showAlert(err.message || "Đăng ký thất bại.", "status-error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng ký tài khoản";
    }
  });
});