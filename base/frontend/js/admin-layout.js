// Layout dùng chung cho khu vực Admin Portal & Cổng soát vé (pages/admin-*.html, pages/staff-passengers.html)
(() => {
  const ADMIN_NAV_ITEMS = [
    { href: "admin-dashboard.html", icon: "dashboard", label: "Tổng quan hệ thống" },
    { href: "admin-routes.html", icon: "alt_route", label: "Quản lý tuyến đường" },
    { href: "admin-trips.html", icon: "departure_board", label: "Quản lý chuyến xe" },
    { href: "admin-seat-maps.html", icon: "event_seat", label: "Loại xe & Sơ đồ ghế" },
    { href: "admin-users.html", icon: "manage_accounts", label: "Người dùng & Tài xế" },
  ];

  const SECONDARY_NAV_ITEMS = [
    { href: "profile.html", icon: "account_circle", label: "Hồ sơ cá nhân" },
    { href: "staff-passengers.html", icon: "qr_code_scanner", label: "Cổng soát vé Staff" },
    { href: "../index.html", icon: "storefront", label: "Về trang đặt vé" },
  ];

  const ACTIVE_CLASSES = "bg-brand-500 text-white font-semibold shadow-sm";
  const IDLE_CLASSES = "hover:bg-slate-800 hover:text-white";

  function getInitial(name) {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  function renderNavLink(item, currentFile) {
    const targetFile = item.href.split("/").pop();
    const isActive = currentFile === targetFile;
    return `
      <a href="${item.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
        isActive ? ACTIVE_CLASSES : IDLE_CLASSES
      }">
        <span class="material-symbols-outlined text-[20px]">${item.icon}</span>
        ${item.label}
      </a>
    `;
  }

  function renderAdminChrome() {
    const currentFile = window.location.pathname.split("/").pop() || "admin-dashboard.html";
    const user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    const displayName = user?.full_name || user?.email || "Quản trị viên";
    const role = typeof Auth !== "undefined" ? Auth.getRole() : "ADMIN";

    const navHtml = ADMIN_NAV_ITEMS.map((item) => renderNavLink(item, currentFile)).join("");
    const secondaryHtml = SECONDARY_NAV_ITEMS.map((item) =>
      renderNavLink(item, currentFile)
    ).join("");

    const sidebarInner = `
      <div class="h-16 px-6 flex items-center justify-between border-b border-slate-800">
        <a href="admin-dashboard.html" class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">directions_bus</span>
          </div>
          <div>
            <span class="font-display font-extrabold text-lg text-white tracking-tight">Bus<span class="text-brand-500">Go</span></span>
            <span class="block text-[10px] uppercase tracking-widest text-slate-400">Admin Portal</span>
          </div>
        </a>
        <button type="button" id="btn-close-mobile-sidebar" class="lg:hidden text-slate-400 hover:text-white">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <nav class="flex-1 px-3 py-5 space-y-1 text-sm font-medium overflow-y-auto">
        ${navHtml}
        <div class="pt-4 mt-4 border-t border-slate-800 space-y-1">
          ${secondaryHtml}
        </div>
      </nav>
    `;

    // Render Desktop Sidebar
    const sidebarEl = document.getElementById("admin-sidebar");
    if (sidebarEl) {
      sidebarEl.className =
        "w-64 bg-slate-900 text-slate-300 hidden lg:flex flex-col shrink-0";
      sidebarEl.innerHTML = sidebarInner;
    }

    // Render Mobile Drawer
    let drawerEl = document.getElementById("admin-mobile-drawer");
    if (!drawerEl) {
      drawerEl = document.createElement("div");
      drawerEl.id = "admin-mobile-drawer";
      drawerEl.className = "hidden fixed inset-0 z-50 lg:hidden flex";
      document.body.appendChild(drawerEl);
    }
    drawerEl.innerHTML = `
      <div id="admin-drawer-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"></div>
      <aside class="relative w-64 max-w-[80vw] bg-slate-900 text-slate-300 flex flex-col h-full z-10 shadow-2xl">
        ${sidebarInner}
      </aside>
    `;

    // Render Sticky Topbar
    const topbarEl = document.getElementById("admin-topbar");
    if (topbarEl) {
      const pageTitle = topbarEl.dataset.title || document.title.replace(" - BusGo Admin", "");
      const actionHtml = topbarEl.dataset.actionHtml || "";
      topbarEl.className =
        "sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 h-16 px-4 sm:px-8 flex items-center justify-between gap-3";
      topbarEl.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" id="btn-open-mobile-sidebar" class="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" title="Mở menu">
            <span class="material-symbols-outlined text-[20px] block">menu</span>
          </button>
          <h1 class="font-display font-bold text-base sm:text-xl text-slate-900 truncate">${pageTitle}</h1>
        </div>

        <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
          ${actionHtml}
          <a href="profile.html" class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition" title="Hồ sơ cá nhân">
            <span class="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">${getInitial(displayName)}</span>
            <span class="text-xs font-semibold text-slate-800 max-w-[130px] truncate">${displayName}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">${role}</span>
          </a>
          <button type="button" id="btn-admin-logout" class="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition" title="Đăng xuất">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span class="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      `;
    }

    // Bind events
    document.getElementById("btn-open-mobile-sidebar")?.addEventListener("click", () => {
      drawerEl.classList.remove("hidden");
    });
    drawerEl.querySelector("#btn-close-mobile-sidebar")?.addEventListener("click", () => {
      drawerEl.classList.add("hidden");
    });
    drawerEl.querySelector("#admin-drawer-backdrop")?.addEventListener("click", () => {
      drawerEl.classList.add("hidden");
    });
    document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
      if (typeof Auth !== "undefined") Auth.logout(true);
    });
  }

  // Kiểm tra đăng nhập & phân quyền theo trang hiện tại
  const currentFile = window.location.pathname.split("/").pop() || "";
  const allowedRoles = currentFile === "staff-passengers.html" ? ["ADMIN", "STAFF"] : ["ADMIN"];

  if (typeof Auth !== "undefined") {
    if (!Auth.requireAuth(allowedRoles)) return;
    Auth.fetchCurrentUser().then((fresh) => {
      if (fresh) {
        const freshRole = String(fresh.role || "").toUpperCase();
        if (!allowedRoles.includes(freshRole)) {
          window.location.href = "../index.html";
          return;
        }
        renderAdminChrome();
      }
    });
  }

  renderAdminChrome();
})();