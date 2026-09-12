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
