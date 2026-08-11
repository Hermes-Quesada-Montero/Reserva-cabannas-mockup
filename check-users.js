// Test directo del endpoint /api/admin/clientes simulando la función getUsuarios
const { dbAll, dbGet } = require('./backend/database/db');

(async () => {
  const buscar = '';
  const rol = 'cliente';
  const estado = '';
  const page = 1;
  const limit = 15;
  const offset = 0;

  let sql = `
    SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.rol, u.activo,
           u.identificacion, u.fecha_nacimiento, u.sexo, u.nacionalidad,
           u.creado_en, cl.total_reservas, cl.total_gastado,
           (u.nombre || ' ' || u.apellido) AS nombre_full
    FROM usuarios u
    LEFT JOIN clientes cl ON cl.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (buscar) {
    sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ? OR u.telefono LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  if (rol) { sql += ' AND u.rol = ?'; params.push(rol); }
  if (estado === 'activo') { sql += ' AND u.activo = 1'; }
  if (estado === 'inactivo') { sql += ' AND u.activo = 0'; }

  const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM (${sql})`, params);
  console.log('Total:', totalRow?.total);

  sql += ` ORDER BY u.creado_en DESC LIMIT ${limit} OFFSET ${offset}`;
  const usuarios = await dbAll(sql, params);

  const data = usuarios.map(u => {
    delete u.password;
    return {
      ...u,
      estado: u.activo === 1 ? 'activo' : 'inactivo',
      created_at: u.creado_en,
      nombre_completo: u.nombre_full || `${u.nombre} ${u.apellido}`,
      num_identificacion: u.identificacion,
      total_reservas: u.total_reservas || 0,
    };
  });

  const response = {
    success: true,
    data,
    total: totalRow?.total || 0,
    stats: { total: totalRow?.total || 0 }
  };
  
  console.log('Response success:', response.success);
  console.log('Data count:', response.data.length);
  console.log('First user:', JSON.stringify(response.data[0], null, 2));
  
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
