document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".mobile-toggle");
  const backdrop = document.querySelector("#sidebarBackdrop");

  const setMenu = (open) => {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    if (backdrop) {
      backdrop.classList.toggle("show", open);
      backdrop.hidden = !open;
    }
  };

  if (toggle && sidebar) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenu(!sidebar.classList.contains("open"));
    });
  }
  backdrop?.addEventListener("click", () => setMenu(false));

  document.addEventListener("click", (e) => {
    if (
      sidebar?.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !toggle?.contains(e.target)
    ) {
      setMenu(false);
    }
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
