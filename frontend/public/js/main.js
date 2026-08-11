/**
 * Cabañas Los Pinos - JavaScript Principal
 * Utilidades compartidas: toasts, modales, auth, API, navbar
 */

// ══════════════════════════════════════════════
// API Helper
// ══════════════════════════════════════════════
const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    return res.json();
  },
  async postForm(url, formData) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    return res.json();
  }
};

// ══════════════════════════════════════════════
// Toast Notifications
// ══════════════════════════════════════════════
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#27ae60"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#e74c3c"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#f39c12"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#3498db"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  function show(message, type = 'info', title = '', duration = 4000) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-msg">${message}</div>
      </div>
      <div class="toast-close">✕</div>
    `;

    toast.style.setProperty('--duration', duration + 'ms');
    toast.querySelector('.toast-close').addEventListener('click', () => remove(toast));
    c.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => remove(toast), duration);
    toast.dataset.timer = timer;
    return toast;
  }

  function remove(toast) {
    clearTimeout(toast.dataset.timer);
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }

  return {
    success: (msg, title = '¡Éxito!')  => show(msg, 'success', title),
    error:   (msg, title = 'Error')    => show(msg, 'error', title),
    warning: (msg, title = 'Atención') => show(msg, 'warning', title),
    info:    (msg, title = 'Info')     => show(msg, 'info', title)
  };
})();

// ══════════════════════════════════════════════
// Modal Manager
// ══════════════════════════════════════════════
const Modal = (() => {
  function open(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Cerrar con click fuera
    overlay.addEventListener('click', function handler(e) {
      if (e.target === overlay) {
        close(id);
        overlay.removeEventListener('click', handler);
      }
    });
    // Cerrar con ESC
    const esc = (e) => { if (e.key === 'Escape') { close(id); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
  }

  function close(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Botones de cierre automáticos
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-close') || e.target.dataset.dismiss === 'modal') {
      const modal = e.target.closest('.modal-overlay');
      if (modal) close(modal.id);
    }
  });

  return { open, close };
})();

// ══════════════════════════════════════════════
// Auth State Manager
// ══════════════════════════════════════════════
const Auth = {
  user: null,

  async check() {
    try {
      const res = await API.get('/api/auth/check-session');
      if (res.success && res.loggedIn) {
        this.user = res.user;
        return true;
      }
      return false;
    } catch { return false; }
  },

  isLoggedIn() { return !!this.user; },
  isAdmin()    { return this.user?.rol === 'admin'; },

  async logout() {
    try {
      await API.post('/api/auth/logout', {});
    } finally {
      this.user = null;
      window.location.href = '/';
    }
  },

  // Mostrar modal de login si no está autenticado
  requireLogin(redirectAfter = null) {
    if (this.isLoggedIn()) return true;
    openLoginModal(redirectAfter);
    return false;
  }
};

// ══════════════════════════════════════════════
// Navbar: scroll + usuario activo
// ══════════════════════════════════════════════
function initNavbar() {
  const navbar   = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (!navbar) return;

  // Scroll effect — si la navbar tiene hero-transparent, quitarla al scroll
  function onScroll() {
    const scrolled = window.scrollY > 60;
    navbar.classList.toggle('scrolled', scrolled);
    if (navbar.classList.contains('hero-transparent')) {
      navbar.style.background = scrolled ? '' : 'transparent';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Hamburger
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });
    // Cerrar al hacer clic en un link
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // Active link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    if (a.getAttribute('href') === currentPath) a.classList.add('active');
  });

  // Dropdown usuario
  const userBtn  = document.querySelector('.nav-user-btn');
  const dropdown = document.querySelector('.nav-dropdown');
  if (userBtn && dropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  // Inicializar estado del usuario
  updateNavUser();
}

async function updateNavUser() {
  const loggedIn = await Auth.check();
  const navGuest   = document.getElementById('nav-guest');
  const navUser    = document.getElementById('nav-user');
  const userNameEl = document.getElementById('nav-user-name');

  if (loggedIn && Auth.user) {
    if (navGuest) navGuest.classList.add('hidden');
    if (navUser)  navUser.classList.remove('hidden');
    if (userNameEl) {
      userNameEl.textContent = Auth.user.nombre;
    }
    // Actualizar avatar
    const avatar = document.querySelector('.nav-user-btn .avatar');
    if (avatar) avatar.textContent = Auth.user.nombre[0].toUpperCase();
  } else {
    if (navGuest) navGuest.classList.remove('hidden');
    if (navUser)  navUser.classList.add('hidden');
  }
}

// ══════════════════════════════════════════════
// Page Loader
// ══════════════════════════════════════════════
function hideLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 600);
  }
}

// Ocultar loader al cargar la página — usar DOMContentLoaded como fallback
// para no quedar bloqueado si fuentes externas fallan
window.addEventListener('load', () => setTimeout(hideLoader, 300));
document.addEventListener('DOMContentLoaded', () => setTimeout(hideLoader, 1500));

// ══════════════════════════════════════════════
// Scroll to Top
// ══════════════════════════════════════════════
function initScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ══════════════════════════════════════════════
// Reveal on Scroll (Intersection Observer)
// ══════════════════════════════════════════════
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  elements.forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════
// Modal Login (solicitar inicio de sesión)
// ══════════════════════════════════════════════
let pendingRedirect = null;

function openLoginModal(redirectAfter = null) {
  pendingRedirect = redirectAfter;

  // Crear modal si no existe
  if (!document.getElementById('modal-login-required')) {
    const div = document.createElement('div');
    div.id = 'modal-login-required';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">🔐 Acceso requerido</h3>
          <button class="modal-close" data-dismiss="modal">✕</button>
        </div>
        <div class="modal-body" style="text-align:center; padding: 2.5rem 2rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">🏕️</div>
          <h3 style="margin-bottom:0.75rem; color:var(--text);">Inicia sesión para continuar</h3>
          <p style="margin-bottom:2rem; color:var(--text-muted);">
            Para confirmar tu reservación y realizar el pago, necesitas<br>
            tener una cuenta o iniciar sesión.
          </p>
          <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:280px; margin:0 auto;">
            <button onclick="goToLogin()" class="btn btn-primary btn-lg" style="justify-content:center; width:100%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Iniciar Sesión
            </button>
            <button onclick="goToRegister()" class="btn btn-outline-primary btn-lg" style="justify-content:center; width:100%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Crear Cuenta
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }
  Modal.open('modal-login-required');
}

window.goToLogin = function goToLogin() {
  const url = pendingRedirect ? `/login?redirect=${encodeURIComponent(pendingRedirect)}` : '/login';
  window.location.href = url;
};
window.goToRegister = function goToRegister() {
  const url = pendingRedirect ? `/registro?redirect=${encodeURIComponent(pendingRedirect)}` : '/registro';
  window.location.href = url;
};

// ══════════════════════════════════════════════
// Formateadores
// ══════════════════════════════════════════════
const Format = {
  currency: (n) => `$${parseFloat(n).toFixed(2)}`,
  date: (d) => {
    if (!d) return 'N/A';
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
  },
  dateShort: (d) => {
    if (!d) return 'N/A';
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CR');
  },
  stars: (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)),
  estado: (e) => ({
    pendiente: '<span class="badge badge-warning">Pendiente</span>',
    confirmada: '<span class="badge badge-success">Confirmada</span>',
    cancelada: '<span class="badge badge-error">Cancelada</span>',
    completada: '<span class="badge badge-info">Completada</span>',
    no_show: '<span class="badge badge-gray">No Show</span>'
  }[e] || `<span class="badge badge-gray">${e}</span>`),
  estadoPago: (e) => ({
    pendiente: '<span class="badge badge-warning">Pendiente</span>',
    pagado: '<span class="badge badge-success">Pagado</span>',
    reembolsado: '<span class="badge badge-info">Reembolsado</span>',
    fallido: '<span class="badge badge-error">Fallido</span>'
  }[e] || `<span class="badge badge-gray">${e}</span>`)
};

// ══════════════════════════════════════════════
// Validadores
// ══════════════════════════════════════════════
const Validate = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v) => /^\+?[\d\s\-()]{7,15}$/.test(v),
  required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
  minLength: (v, n) => String(v).length >= n,
  password: (v) => v.length >= 6,

  form(rules) {
    const errors = {};
    for (const [field, checks] of Object.entries(rules)) {
      const input = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
      if (!input) continue;
      const value = input.value.trim();
      for (const [check, param] of Object.entries(checks)) {
        let valid = true;
        if (check === 'required' && !this.required(value)) { valid = false; }
        else if (check === 'email' && value && !this.email(value)) { valid = false; }
        else if (check === 'minLength' && !this.minLength(value, param)) { valid = false; }
        if (!valid) {
          errors[field] = param === true ? `Campo requerido` : param;
          setFieldError(input, errors[field]);
          break;
        } else {
          clearFieldError(input);
        }
      }
    }
    return Object.keys(errors).length === 0;
  }
};

function setFieldError(input, message) {
  input.classList.add('error');
  input.classList.remove('success');
  let err = input.parentElement.querySelector('.form-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'form-error';
    input.parentElement.appendChild(err);
  }
  err.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${message}`;
}

function clearFieldError(input) {
  input.classList.remove('error');
  input.classList.add('success');
  const err = input.parentElement?.querySelector('.form-error');
  if (err) err.remove();
  setTimeout(() => input.classList.remove('success'), 2000);
}

// ══════════════════════════════════════════════
// Lightbox Gallery
// ══════════════════════════════════════════════
function initLightbox() {
  let currentItems = [];
  let currentIndex = 0;

  // Crear lightbox si no existe
  if (!document.getElementById('lightbox')) {
    const lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = `
      <button class="lightbox-close">✕</button>
      <button class="lightbox-nav lightbox-prev">‹</button>
      <img src="" alt="" id="lightbox-img">
      <button class="lightbox-nav lightbox-next">›</button>
    `;
    document.body.appendChild(lb);
  }

  const lb    = document.getElementById('lightbox');
  const img   = document.getElementById('lightbox-img');
  const close = lb.querySelector('.lightbox-close');
  const prev  = lb.querySelector('.lightbox-prev');
  const next  = lb.querySelector('.lightbox-next');

  function show(items, idx) {
    currentItems = items;
    currentIndex = idx;
    img.src = items[idx].src;
    img.alt = items[idx].alt || '';
    lb.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function navigate(dir) {
    currentIndex = (currentIndex + dir + currentItems.length) % currentItems.length;
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = currentItems[currentIndex].src;
      img.style.opacity = '1';
    }, 150);
  }

  close.addEventListener('click', () => { lb.classList.remove('show'); document.body.style.overflow = ''; });
  prev.addEventListener('click', () => navigate(-1));
  next.addEventListener('click', () => navigate(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) { lb.classList.remove('show'); document.body.style.overflow = ''; } });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'Escape') { lb.classList.remove('show'); document.body.style.overflow = ''; }
  });

  // Inicializar items de la página
  document.querySelectorAll('.gallery-item[data-lightbox]').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const allItems = [...document.querySelectorAll('.gallery-item[data-lightbox]')].map(i => ({
        src: i.dataset.src || i.querySelector('img')?.src,
        alt: i.dataset.title || i.querySelector('img')?.alt
      }));
      show(allItems, idx);
    });
  });
}

// ══════════════════════════════════════════════
// Tabs
// ══════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabsEl => {
    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        // Si la página define activateTab (ej: cabana-detalle con calendario),
        // delegarle toda la lógica para evitar duplicidad.
        if (typeof window.activateTab === 'function') {
          window.activateTab(target);
          return;
        }
        // Lógica genérica para páginas sin activateTab
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tabsEl.querySelectorAll('.tab-btn').forEach(b => {
          const c = document.getElementById(`tab-${b.dataset.tab}`);
          if (c) c.classList.remove('active');
        });
        const content = document.getElementById(`tab-${target}`);
        if (content) content.classList.add('active');
      });
    });
  });
}

// ══════════════════════════════════════════════
// Número contador animado
// ══════════════════════════════════════════════
function animateCounter(el, target, duration = 1500) {
  const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  const step = (target - start) / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += step;
    if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
      el.textContent = formatNumber(target);
      clearInterval(timer);
    } else {
      el.textContent = formatNumber(Math.round(current));
    }
  }, 16);
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// ══════════════════════════════════════════════
// Inicialización Global
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollTop();
  initReveal();
  initTabs();
  initLightbox();
});

// ══════════════════════════════════════════════
// Traductor de Idioma (Google Translate)
// Lista fija de 10 idiomas — dropdown instantáneo
// GT se carga solo cuando el usuario elige idioma
// ══════════════════════════════════════════════
(function () {
  if (window.location.pathname.startsWith('/admin')) return;

  var SOURCE_LANG = 'es';
  var gtSelGlobal = null;
  var gtLoaded    = false;
  var pendingCode = null; // idioma a aplicar cuando GT termine de cargar

  var LANGUAGES = [
    { code: 'es',    name: '🇪🇸 Español'    },
    { code: 'en',    name: '🇺🇸 English'    },
    { code: 'fr',    name: '🇫🇷 Français'   },
    { code: 'de',    name: '🇩🇪 Deutsch'    },
    { code: 'it',    name: '🇮🇹 Italiano'   },
    { code: 'pt',    name: '🇧🇷 Português'  },
    { code: 'zh-CN', name: '🇨🇳 中文'       },
    { code: 'ja',    name: '🇯🇵 日本語'     },
    { code: 'ru',    name: '🇷🇺 Русский'    },
    { code: 'ar',    name: '🇸🇦 العربية'    },
  ];

  // ── Persistencia ─────────────────────────────────────────────
  function getStoredLang() {
    try { return localStorage.getItem('lospinos_lang') || SOURCE_LANG; } catch (e) { return SOURCE_LANG; }
  }
  function storeLang(code) {
    try { localStorage.setItem('lospinos_lang', code); } catch (e) {}
  }

  // ── Nombre del idioma activo ──────────────────────────────────
  function getLangName(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i].name;
    }
    return LANGUAGES[0].name;
  }

  // ── Actualizar etiqueta del botón ─────────────────────────────
  function updateLabel(code) {
    var el = document.getElementById('lang-current-label');
    if (el) el.textContent = getLangName(code);
  }

  // ── Aplicar traducción vía GT ─────────────────────────────────
  function applyLang(code) {
    if (!gtSelGlobal) return;
    gtSelGlobal.value = code === SOURCE_LANG ? '' : code;
    gtSelGlobal.dispatchEvent(new Event('change'));
  }

  // ── Cargar GT solo la primera vez que se necesite ─────────────
  function loadGT(code) {
    pendingCode = code;
    if (gtLoaded) { applyLang(code); return; }
    gtLoaded = true;

    if (!document.getElementById('google_translate_element')) {
      var div = document.createElement('div');
      div.id = 'google_translate_element';
      div.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      document.body.appendChild(div);
    }

    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement(
        { pageLanguage: SOURCE_LANG, autoDisplay: false },
        'google_translate_element'
      );
      waitForGTSelect(0);
    };

    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  // ── Esperar el select interno de GT y aplicar pendingCode ────
  function waitForGTSelect(tries) {
    var sel = document.querySelector('.goog-te-combo');
    if (sel && sel.options.length > 1) {
      gtSelGlobal = sel;
      if (pendingCode) applyLang(pendingCode);
      return;
    }
    if (tries > 100) return;
    setTimeout(function () { waitForGTSelect(tries + 1); }, 150);
  }

  // ── Seleccionar idioma ────────────────────────────────────────
  function selectLang(code) {
    storeLang(code);
    updateLabel(code);

    // Marcar activo en dropdown
    var opts = document.querySelectorAll('.lang-option');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-lang') === code);
    }
    var mSel = document.getElementById('mobile-lang-select');
    if (mSel) mSel.value = code;

    // Si vuelve a español, recargar la página sin traducción
    if (code === SOURCE_LANG) {
      var cookie = document.cookie.match(/googtrans=([^;]+)/);
      if (cookie) {
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname;
        location.reload();
      }
      return;
    }

    loadGT(code);
  }

  // ── Construir dropdown ────────────────────────────────────────
  function renderDropdownOptions() {
    var active = getStoredLang();
    var html = '';
    for (var i = 0; i < LANGUAGES.length; i++) {
      var l = LANGUAGES[i];
      html += '<button class="lang-option' + (l.code === active ? ' active' : '') +
        '" data-lang="' + l.code + '">' + l.name + '</button>';
    }
    return html;
  }

  // ── Construir botón en navbar ─────────────────────────────────
  function buildButton() {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks || document.getElementById('lang-toggle-btn')) return;

    var active = getStoredLang();
    var wrapper = document.createElement('div');
    wrapper.className = 'lang-selector';
    wrapper.id = 'lang-selector-wrapper';
    wrapper.innerHTML =
      '<button class="lang-btn" id="lang-toggle-btn" aria-label="Cambiar idioma">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<line x1="2" y1="12" x2="22" y2="12"/>' +
          '<path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z"/>' +
        '</svg>' +
        '<span id="lang-current-label">' + getLangName(active) + '</span>' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
          '<polyline points="6 9 12 15 18 9"/>' +
        '</svg>' +
      '</button>' +
      '<div class="lang-dropdown" id="lang-dropdown">' +
        '<div class="lang-options-list">' + renderDropdownOptions() + '</div>' +
      '</div>';

    navLinks.appendChild(wrapper);

    var toggleBtn = document.getElementById('lang-toggle-btn');
    var dropdown  = document.getElementById('lang-dropdown');

    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', function () { dropdown.classList.remove('show'); });
    dropdown.addEventListener('click', function (e) { e.stopPropagation(); });

    // Click en cada opción
    var btns = dropdown.querySelectorAll('.lang-option');
    for (var j = 0; j < btns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          selectLang(btn.getAttribute('data-lang'));
          dropdown.classList.remove('show');
        });
      })(btns[j]);
    }
  }

  // ── Construir selector móvil ──────────────────────────────────
  function buildMobileSelector() {
    var mobileNav = document.querySelector('.mobile-nav');
    if (!mobileNav || document.getElementById('mobile-lang-select')) return;

    var active = getStoredLang();
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:1rem;border-bottom:1px solid rgba(255,255,255,0.1)';

    var label = document.createElement('div');
    label.style.cssText = 'color:rgba(255,255,255,0.55);font-size:0.72rem;margin-bottom:0.5rem;letter-spacing:1px;text-transform:uppercase';
    label.textContent = 'Idioma / Language';

    var sel = document.createElement('select');
    sel.id = 'mobile-lang-select';
    sel.style.cssText = 'width:100%;padding:0.65rem 1rem;background:rgba(255,255,255,0.08);border:1px solid rgba(200,169,81,0.4);border-radius:30px;color:white;font-size:0.95rem;font-family:inherit;cursor:pointer;outline:none';

    for (var i = 0; i < LANGUAGES.length; i++) {
      var opt = document.createElement('option');
      opt.value = LANGUAGES[i].code;
      opt.textContent = LANGUAGES[i].name;
      opt.style.background = '#1a3009';
      if (LANGUAGES[i].code === active) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', function () { selectLang(sel.value); });

    wrapper.appendChild(label);
    wrapper.appendChild(sel);
    mobileNav.appendChild(wrapper);
  }

  // ── Inicializar ───────────────────────────────────────────────
  function init() {
    buildButton();
    buildMobileSelector();

    // Si hay idioma guardado distinto al origen, cargar GT de inmediato
    var stored = getStoredLang();
    if (stored !== SOURCE_LANG) loadGT(stored);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
