const db = require('./backend/database/db');
(async () => {
  // Test: guardar respuesta en mensaje id=5
  await db.dbRun(
    "UPDATE mensajes_contacto SET respuesta_admin=?, respondido_en=datetime('now'), estado=? WHERE id=?",
    ['Respuesta de prueba del admin: sus precios están disponibles en nuestra web.', 'respondido', 5]
  );
  const m = await db.dbGet('SELECT id, estado, respuesta_admin, respondido_en FROM mensajes_contacto WHERE id=5');
  console.log('Resultado UPDATE:', JSON.stringify(m, null, 2));

  // Test: leer mensajes del usuario_id=5
  const msgs = await db.dbAll(
    'SELECT id, asunto, mensaje, estado, respuesta_admin, respondido_en, creado_en FROM mensajes_contacto WHERE usuario_id=? ORDER BY creado_en DESC',
    [5]
  );
  console.log('Mensajes usuario 5:', JSON.stringify(msgs, null, 2));
})();
