(() => {
  const slides = Array.from(document.querySelectorAll(".ml-slide"));
  if (!slides.length) return;

  const fill = document.getElementById("mlProgressFill");
  const label = document.getElementById("mlProgressLabel");
  const titleEl = document.getElementById("mlSlideTitle");
  const dotsWrap = document.getElementById("mlDots");
  const toc = document.getElementById("mlToc");
  const tocList = document.getElementById("mlTocList");
  const btnPrev = document.getElementById("mlPrev");
  const btnNext = document.getElementById("mlNext");
  const btnToc = document.getElementById("mlTocBtn");
  const btnStart = document.getElementById("mlStart");

  let index = 0;
  let animating = false;

  const titles = slides.map(
    (s) => s.dataset.title || s.querySelector("h2")?.textContent?.trim() || "شريحة"
  );

  function buildChrome() {
    dotsWrap.innerHTML = "";
    tocList.innerHTML = "";
    slides.forEach((slide, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "ml-dot";
      dot.setAttribute("aria-label", `الانتقال إلى: ${titles[i]}`);
      dot.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(dot);

      const item = document.createElement("button");
      item.type = "button";
      item.textContent = `${i}. ${titles[i]}`;
      item.addEventListener("click", () => {
        goTo(i);
        toc.classList.remove("is-open");
      });
      tocList.appendChild(item);
    });
  }

  function syncChrome() {
    const pct = ((index + 1) / slides.length) * 100;
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${index + 1} / ${slides.length}`;
    if (titleEl) titleEl.textContent = titles[index];

    dotsWrap.querySelectorAll(".ml-dot").forEach((d, i) => {
      d.classList.toggle("is-active", i === index);
    });
    tocList.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("is-active", i === index);
    });

    if (btnPrev) btnPrev.disabled = index === 0;
    if (btnNext) btnNext.disabled = index === slides.length - 1;

    const active = slides[index];
    active.querySelectorAll(".ml-fade-up").forEach((el, i) => {
      el.style.animationDelay = `${0.08 + i * 0.06}s`;
    });
  }

  function goTo(next, dir) {
    if (animating || next === index || next < 0 || next >= slides.length) return;
    animating = true;
    const current = slides[index];
    const target = slides[next];
    const goingNext = dir != null ? dir > 0 : next > index;

    current.classList.remove("is-active");
    current.classList.add(goingNext ? "is-exit-next" : "is-exit-prev");
    target.classList.add("is-active");

    index = next;
    syncChrome();
    history.replaceState(null, "", `#slide-${index}`);

    window.setTimeout(() => {
      current.classList.remove("is-exit-next", "is-exit-prev");
      animating = false;
    }, 420);
  }

  function next() { goTo(index + 1, 1); }
  function prev() { goTo(index - 1, -1); }

  buildChrome();

  const hash = location.hash.match(/slide-(\d+)/);
  if (hash) {
    const n = Number(hash[1]);
    if (!Number.isNaN(n) && n >= 0 && n < slides.length) index = n;
  }

  slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
  syncChrome();

  btnPrev?.addEventListener("click", prev);
  btnNext?.addEventListener("click", next);
  btnStart?.addEventListener("click", () => goTo(1, 1));
  btnToc?.addEventListener("click", () => toc.classList.toggle("is-open"));

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (["ArrowLeft", "PageDown", " ", "Enter"].includes(e.key)) {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowRight" || e.key === "PageUp" || e.key === "Backspace") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(slides.length - 1);
    } else if (e.key === "Escape") {
      toc.classList.remove("is-open");
    } else if (e.key.toLowerCase() === "t") {
      toc.classList.toggle("is-open");
    }
  });

  let touchX = null;
  document.addEventListener("touchstart", (e) => {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 48) return;
    if (dx > 0) next();
    else prev();
  }, { passive: true });
})();
