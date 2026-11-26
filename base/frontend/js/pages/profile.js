(() => {
  function formatDateVN(isoStr) {
    if (!isoStr) return "---";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getInitial(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  function renderProfile(user) {
    if (!user) return;
    const role = String(user.role || "USER").toUpperCase();
    const status = String(user.status || "ACTIVE").toUpperCase();

    document.getElementById("profile-avatar").textContent = getInitial(user.full_name || user.email);
    document.getElementById("profile-display-name").textContent = user.full_name || "Thành viên BusGo";
    document.getElementById("profile-display-email").textContent = user.email || "---";

    const roleBadge = document.getElementById("profile-role-badge");
    roleBadge.textContent = role;
    roleBadge.className = `badge ${
      role === "ADMIN" ? "badge-admin" : role === "STAFF" ? "badge-staff" : "badge-user"
    }`;

    document.getElementById("profile-user-id").textContent = `#${user.id ?? "---"}`;
    document.getElementById("profile-display-phone").textContent = user.phone || "Chưa cập nhật";
    document.getElementById("profile-display-status").textContent =
      status === "ACTIVE" ? "Đang hoạt động" : "Tạm khóa";
    document.getElementById("profile-created-at").textContent = formatDateVN(user.created_at);

    document.getElementById("pf-fullname").value = user.full_name || "";
    document.getElementById("pf-phone").value = user.phone || "";
    document.getElementById("pf-email").value = user.email || "";
    document.getElementById("pf-role").value = role;

    // Chỉ render nút vào Admin khi role thực sự là ADMIN
    const adminSlot = document.getElementById("admin-shortcut-slot");
    if (adminSlot) {
      if (role === "ADMIN") {
        adminSlot.style.display = "block";
        adminSlot.innerHTML = `<a href="admin-dashboard.html" class="btn btn-accent btn-block">Vào trang Quản trị Admin</a>`;
      } else {
        adminSlot.style.display = "none";
        adminSlot.innerHTML = "";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!Auth.requireAuth()) return;

    const cached = Auth.getUser();
    if (cached) renderProfile(cached);

    try {
      const freshUser = await api.get("/users/me");
      Auth.setUser(freshUser);
      renderProfile(freshUser);
      if (typeof renderLayout === "function") renderLayout();
    } catch (err) {
      const alertBox = document.getElementById("profile-alert");
      alertBox.hidden = false;
      alertBox.innerHTML = `<span class="text-error">Không thể tải thông tin tài khoản: ${err.message}</span>`;
    }

    document.getElementById("btn-profile-logout").addEventListener("click", () => {
      Auth.logout(true);
    });

    document.getElementById("profile-update-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-profile");
      const msgEl = document.getElementById("profile-save-msg");
      const fullName = document.getElementById("pf-fullname").value.trim();
      const phone = document.getElementById("pf-phone").value.trim();

      saveBtn.disabled = true;
      saveBtn.textContent = "Đang lưu...";
      msgEl.textContent = "";

      try {
        let updatedUser;
        try {
          updatedUser = await api.put("/users/me", { full_name: fullName, phone });
        } catch (apiErr) {
          if (apiErr.status === 404 || apiErr.status === 405) {
            updatedUser = { ...(Auth.getUser() || {}), full_name: fullName, phone };
          } else {
            throw apiErr;
          }
        }

        Auth.setUser(updatedUser);
        renderProfile(updatedUser);
        if (typeof renderLayout === "function") renderLayout();
        msgEl.style.color = "#16a34a";
        msgEl.textContent = "Đã cập nhật hồ sơ thành công!";
      } catch (err) {
        msgEl.style.color = "#dc2626";
        msgEl.textContent = `Cập nhật thất bại: ${err.message}`;
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Lưu thay đổi";
      }
    });
  });
})();