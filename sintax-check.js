let currentPage = 1;
const perPage = 15;
let debounceTimer;

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadUsuarios(1), 400);
}

async function loadUsuarios(page = 1) {
  currentPage = page;
  const buscar = 'test';
  const estado = '';
  let url = '/api/admin/clientes?page=' + page + '&per_page=' + perPage;
  if (buscar) url += '&q=' + encodeURIComponent(buscar);
  if (estado) url += '&estado=' + estado;
  try {
    const res = { success: true, data: [], total: 0, stats: {} };
    if (!res || !res.success) throw new Error(res?.message || 'Error del servidor');
    const { data = [], total = 0, stats = {} } = res;
    const a = stats.total ?? total;
    const b = stats.activos ?? 'x';
    const c = stats.con_reservas ?? 'x';
    const d = stats.nuevos_mes ?? 'x';
    console.log('loadUsuarios OK', a, b, c, d);
  } catch(e) {
    console.error('loadUsuarios error:', e.message);
  }
}

async function toggleEstado(id, estadoActual) {
  const nuevo = estadoActual === 'activo' ? 'inactivo' : 'activo';
  const accion = nuevo === 'inactivo' ? 'suspender' : 'activar';
  console.log('toggleEstado OK', nuevo, accion);
}

function formatDate(str) {
  if (!str) return '--';
  return new Date(str).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

loadUsuarios(1).then(() => toggleEstado(1, 'activo')).then(() => console.log('SYNTAX OK'));
