document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".mobile-toggle");
  const backdrop = document.querySelector("#sidebarBackdrop");
  const menuClose = document.querySelector("#menuClose");

  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  const setMenu = (open) => {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open && isMobile());
    if (backdrop) {
      backdrop.classList.toggle("show", open);
      backdrop.hidden = !open;
      backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  };

  if (toggle && sidebar) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu(!sidebar.classList.contains("open"));
    });
  }

  menuClose?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(false);
  });

  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu(false);
    });
  }

  // ضمان انتقال الروابط حتى لو أُغلق الرسم أثناء اللمس
  sidebar?.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener(
      "click",
      (e) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        e.preventDefault();
        window.location.assign(href);
      },
      { passive: false }
    );
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) setMenu(false);
  });


  const themeBtn = document.querySelector("#themeToggle");
  const syncThemeIcon = () => {
    if (!themeBtn) return;
    const light = document.documentElement.getAttribute("data-theme") === "light";
    const icon = themeBtn.querySelector("i");
    const label = themeBtn.querySelector("span");
    if (icon) icon.className = light ? "fa-solid fa-sun" : "fa-solid fa-moon";
    if (label) label.textContent = light ? "نهاري" : "ليلي";
  };
  syncThemeIcon();
  themeBtn?.addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", next === "light" ? "light" : "dark");
    } catch (e) {}
    syncThemeIcon();
  });

  document.querySelectorAll("[data-confirm]").forEach((el) => {
    el.addEventListener("submit", (e) => {
      if (!confirm(el.getAttribute("data-confirm") || "تأكيد العملية؟")) {
        e.preventDefault();
      }
    });
  });

  const currentToggle = document.querySelector("#is_current");
  const exitField = document.querySelector("#exit_date_wrap");
  if (currentToggle && exitField) {
    const sync = () => {
      exitField.style.opacity = currentToggle.checked ? "0.45" : "1";
      const input = exitField.querySelector("input");
      if (input) input.disabled = currentToggle.checked;
    };
    currentToggle.addEventListener("change", sync);
    sync();
  }
});
