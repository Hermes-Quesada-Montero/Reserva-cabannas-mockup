/**
 * Admin.js - JavaScript compartido para el panel administrativo
 * Incluye: autenticación, sidebar, toasts, modales, helpers CRUD
 */

// Bandera para evitar redirección de auth durante logout
let _loggingOut = false;

// ── Verificar autenticación admin ─────────────────────────────
async function requireAdminAuth() {
  try {
    const res = await fetch('/api/auth/check-session', { credentials: 'include' });
    const data = await res.json();
    if (!data.loggedIn || data.user?.rol !== 'admin') {
      if (!_loggingOut) window.location.href = '/admin/login';
      return false;
    }
    // Mostrar nombre del admin
    const nameEl = document.getElementById('admin-name');
    if (nameEl) nameEl.textContent = `${data.user.nombre} ${data.user.apellido}`;
    return true;
  } catch {
    if (!_loggingOut) window.location.href = '/admin/login';
    return false;
  }
}

// ── API Helper ─────────────────────────────────────────────────
const AdminAPI = {
  async get(url) {
    const res = await fetch('/api/admin' + url, { credentials: 'include' });
    return res.json();
  },
  async post(url, data) {
    const res = await fetch('/api/admin' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch('/api/admin' + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(url) {
    const res = await fetch('/api/admin' + url, { method: 'DELETE', credentials: 'include' });
    return res.json();
  },
  async postForm(url, formData) {
    const res = await fetch('/api/admin' + url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    return res.json();
  }
};

// ── Toast Notifications ───────────────────────────────────────
const AdminToast = {
  container: null,
  getContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'admin-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  },
  show(message, type = 'info', duration = 3500) {
    const c     = this.getContainer();
    const toast = document.createElement('div');
    const icons = {
      success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
    };
    toast.className = `admin-toast admin-toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
    c.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: function(msg) { this.show(msg, 'success'); },
  error:   function(msg) { this.show(msg, 'error'); },
  warning: function(msg) { this.show(msg, 'warning'); }
};

// ── Modal Admin ────────────────────────────────────────────────
const AdminModal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('show'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); document.body.style.overflow = ''; }
  }
};

// Auto-cerrar modales al hacer click en overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-modal-overlay')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// ── Confirmación de eliminación ───────────────────────────────
function confirmDelete(msg = '¿Estás seguro de que deseas eliminar este elemento?') {
  return confirm(msg);
}

// ── Formateadores ─────────────────────────────────────────────
const AdminFmt = {
  currency: (n) => `$${parseFloat(n||0).toFixed(2)}`,
  date: (d) => {
    if (!d) return 'N/A';
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CR', { day:'2-digit', month:'short', year:'numeric' });
  },
  estado: (e) => {
    if (!e) return '<span class="badge-admin badge-gray">N/A</span>';
    const map = {
      pendiente: '<span class="badge-admin badge-yellow">Pendiente</span>',
      confirmada: '<span class="badge-admin badge-green">Confirmada</span>',
      cancelada: '<span class="badge-admin badge-red">Cancelada</span>',
      completada: '<span class="badge-admin badge-blue">Completada</span>',
      no_show: '<span class="badge-admin badge-gray">No Show</span>',
      pagado: '<span class="badge-admin badge-green">Pagado</span>',
      fallido: '<span class="badge-admin badge-red">Fallido</span>',
      reembolsado: '<span class="badge-admin badge-purple">Reembolsado</span>',
      nuevo: '<span class="badge-admin badge-blue">Nuevo</span>',
      respondido: '<span class="badge-admin badge-green">Respondido</span>'
    };
    return map[String(e).toLowerCase()] || `<span class="badge-admin badge-gray">${e}</span>`;
  }
};

// ── Paginación ─────────────────────────────────────────────────
function renderPagination(container, currentPage, total, limit, onPageChange) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<div class="admin-pagination">`;
  html += `<div class="page-item ${currentPage === 1 ? 'disabled' : ''}" onclick="${currentPage > 1 ? `(${onPageChange})(${currentPage-1})` : ''}">‹</div>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<div class="page-item ${i === currentPage ? 'active' : ''}" onclick="(${onPageChange})(${i})">${i}</div>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<div class="page-item disabled">…</div>`;
    }
  }
  html += `<div class="page-item ${currentPage === totalPages ? 'disabled' : ''}" onclick="${currentPage < totalPages ? `(${onPageChange})(${currentPage+1})` : ''}">›</div>`;
  html += `</div>`;
  container.innerHTML = html;
}

// ── Sidebar dinámico ───────────────────────────────────────────
async function initAdminSidebar() {
  const currentPath = window.location.pathname;

  // Reemplazar el aside estático por el sidebar canónico
  const existingAside = document.getElementById('admin-sidebar');
  if (existingAside) {
    try {
      const html = await fetch('/views/admin/_sidebar.html').then(r => r.text());
      const tmp  = document.createElement('div');
      tmp.innerHTML = html;
      const newAside = tmp.querySelector('aside');
      if (newAside) existingAside.replaceWith(newAside);
    } catch (_) { /* si falla el fetch, usa el sidebar inline existente */ }
  }

  // Marcar item activo
  document.querySelectorAll('.admin-menu-item').forEach(item => {
    const href = item.getAttribute('href');
    if (!href) return;
    if (href === '/admin/dashboard' && (currentPath === '/admin' || currentPath.startsWith('/admin/dashboard'))) {
      item.classList.add('active');
    } else if (href !== '/admin/dashboard' && href !== '/admin' && currentPath.startsWith(href)) {
      item.classList.add('active');
    }
  });

  // Badge de mensajes no leídos (visible en todas las páginas)
  try {
    const data = await fetch('/api/admin/mensajes?estado=nuevo', { credentials: 'include' }).then(r => r.json());
    const count = data?.stats?.nuevos || 0;
    if (count > 0) {
      const menuMsj = document.getElementById('menu-mensajes');
      if (menuMsj && !menuMsj.querySelector('.menu-badge')) {
        menuMsj.insertAdjacentHTML('beforeend', `<span class="menu-badge">${count}</span>`);
      }
    }
  } catch (_) { /* ignorar si falla */ }

  // Logout
  document.getElementById('admin-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    _loggingOut = true;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) { /* ignorar errores de red */ }
    window.location.href = '/';
  });
}

// ── Aliases compatibles (usados en algunos HTMLs) ──────────────
window.checkAdminAuth = function() { /* no-op: la auth ya se verifica en adminAuthReady */ };
window.adminLogout    = async function() {
  _loggingOut = true;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (_) { /* ignorar errores de red */ }
  window.location.href = '/';
};

// adminFetch: alias de AdminAPI para páginas que lo usan directamente
window.adminFetch = async function(url, methodOrOptions = {}, bodyArg) {
  let method, body;
  if (typeof methodOrOptions === 'string') {
    method = methodOrOptions.toUpperCase();
    body   = bodyArg;
  } else {
    method = (methodOrOptions.method || 'GET').toUpperCase();
    body   = methodOrOptions.body;
  }
  const headers = { 'Accept': 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    redirect: 'follow',
    body: body ? JSON.stringify(body) : undefined
  });

  // Si el servidor redirigió a login o devolvió HTML
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.url && res.url.includes('/login')) {
      window.location.href = '/admin/login';
    }
    return { success: false, message: 'Sesión expirada. Redirigiendo al login...' };
  }

  const data = await res.json();
  if ((res.status === 401 || res.status === 403) && data.requireLogin) {
    window.location.href = '/admin/login';
  }
  return data;
};

// showToast: alias de AdminToast para páginas que lo usan directamente
window.showToast = function(message, type = 'info') {
  AdminToast.show(message, type);
};

// ── Init ───────────────────────────────────────────────────────
window.adminAuthReady = (async () => {
  const ok = await requireAdminAuth();
  if (ok) initAdminSidebar();
  return ok;
})();

window.adminReady = function(fn) {
  window.adminAuthReady.then(ok => { if (ok) fn(); });
};