/* Johannes K. Schmidt
   Shared behavior: navigation menus and the homepage quotation carousel.
*/

(() => {
  /* Navigation menus */

  const menuButtons = Array.from(document.querySelectorAll('.dropbtn[aria-controls]'));

  const closeMenu = (button) => button.setAttribute('aria-expanded', 'false');

  menuButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const wasOpen = button.getAttribute('aria-expanded') === 'true';
      menuButtons.forEach(closeMenu);
      button.setAttribute('aria-expanded', String(!wasOpen));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openButton = menuButtons.find((b) => b.getAttribute('aria-expanded') === 'true');
    if (openButton) {
      closeMenu(openButton);
      openButton.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown')) menuButtons.forEach(closeMenu);
  });

  document.addEventListener('focusin', (event) => {
    menuButtons.forEach((button) => {
      if (!button.parentElement.contains(event.target)) closeMenu(button);
    });
  });

  document.querySelectorAll(".submenu-btn").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();

    const isOpen = button.getAttribute("aria-expanded") === "true";

    /* Close sibling submenus */
    const parentMenu = button.closest(".dropdown-menu");

    parentMenu
      .querySelectorAll(".submenu-btn[aria-expanded='true']")
      .forEach((otherButton) => {
        if (otherButton !== button) {
          otherButton.setAttribute("aria-expanded", "false");
        }
      });

    button.setAttribute("aria-expanded", String(!isOpen));
  });
});

  /* Topic filter: pills show only the articles tagged with that keyword */

  document.querySelectorAll('.topic-filter').forEach((bar) => {
    const list = document.getElementById(bar.dataset.filterFor);
    if (!list) return;

    const pills = Array.from(bar.querySelectorAll('.topic-pill'));
    const status = bar.querySelector('.topic-filter__status');
    const items = Array.from(list.querySelectorAll(':scope > .article-item'));
    const topicsOf = new Map(items.map((item) => [
      item,
      Array.from(item.querySelectorAll('.keyword')).map((k) => k.textContent.trim().toLowerCase()),
    ]));

    const apply = (topic) => {
      let shown = 0;
      items.forEach((item) => {
        const match = !topic || topicsOf.get(item).includes(topic);
        item.hidden = !match;
        if (match) shown += 1;
      });

      let label = '';
      pills.forEach((pill) => {
        const active = pill.dataset.topic === topic;
        pill.setAttribute('aria-pressed', String(active));
        if (active) label = pill.textContent.trim();
      });

      if (status) {
        status.textContent = topic
          ? `Showing ${shown} of ${items.length} articles · ${label}`
          : `Showing all ${items.length} articles`;
      }
    };

    // Clicking the active topic again returns to the full list.
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const isActive = pill.getAttribute('aria-pressed') === 'true';
        apply(isActive ? '' : pill.dataset.topic);
      });
    });

    bar.hidden = false;
    apply('');
  });

  /* Publication carousel: arrows page through a scroll-snap track */

  document.querySelectorAll('.card-carousel__nav').forEach((nav) => {
    const buttons = Array.from(nav.querySelectorAll('.card-carousel__btn'));
    const track = buttons[0] && document.getElementById(buttons[0].getAttribute('aria-controls'));
    if (!track) return;

    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      nav.hidden = max <= 1;
      buttons.forEach((button) => {
        const dir = Number(button.dataset.dir);
        button.disabled = dir < 0 ? track.scrollLeft <= 1 : track.scrollLeft >= max - 1;
      });
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        track.scrollBy({
          left: Number(button.dataset.dir) * track.clientWidth,
          behavior: smooth ? 'smooth' : 'auto',
        });
      });
    });

    track.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(track);
    update();
  });

  /* Hero carousel */

  const carousel = document.querySelector('.hero-carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.photo-hero-fluid'));
  const dots = Array.from(carousel.querySelectorAll('.hero-carousel__dot'));
  const toggle = carousel.querySelector('.hero-carousel__toggle');
  const controls = carousel.querySelector('.hero-carousel__dots');

  if (slides.length <= 1) {
    if (controls) controls.hidden = true;
    return;
  }

  const INTERVAL_MS = 30000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentIndex = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
  let timer = null;
  let userPaused = reduceMotion;
  let hovering = false;
  let focused = false;

  const showSlide = (index) => {
    slides.forEach((slide, n) => {
      const active = n === index;
      slide.classList.toggle('is-active', active);
      slide.toggleAttribute('inert', !active);
      if (active) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });

    dots.forEach((dot, n) => {
      dot.classList.toggle('is-active', n === index);
      if (n === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });

    currentIndex = index;
  };

  // Rotation runs only when nothing has asked it to stop.
  const syncTimer = () => {
    clearInterval(timer);
    timer = null;
    if (userPaused || hovering || focused || document.hidden) return;
    timer = setInterval(() => showSlide((currentIndex + 1) % slides.length), INTERVAL_MS);
  };

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showSlide(index);
      syncTimer();
    });
  });

  if (toggle) {
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      toggle.setAttribute('aria-pressed', String(userPaused));
      syncTimer();
    });
  }

  carousel.addEventListener('mouseenter', () => { hovering = true; syncTimer(); });
  carousel.addEventListener('mouseleave', () => { hovering = false; syncTimer(); });
  carousel.addEventListener('focusin', () => { focused = true; syncTimer(); });
  carousel.addEventListener('focusout', (event) => {
    focused = carousel.contains(event.relatedTarget);
    syncTimer();
  });
  document.addEventListener('visibilitychange', syncTimer);

  showSlide(currentIndex);
  syncTimer();
})();
