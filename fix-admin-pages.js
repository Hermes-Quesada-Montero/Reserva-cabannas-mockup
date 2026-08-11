/**
 * Reemplaza DOMContentLoaded+checkAdminAuth por adminReady(fn)
 * en todas las páginas del panel admin.
 */
const fs   = require('fs');
const path = require('path');

const adminViews = path.join(__dirname, 'frontend/views/admin');
const files = fs.readdirSync(adminViews)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(adminViews, f));

// Regex que captura el bloque completo:
//   document.addEventListener('DOMContentLoaded', () => {
//     checkAdminAuth();
//     <cargas>
//     document.getElementById('admin-logout')...
//   });
const RE = /document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{\s*checkAdminAuth\(\);\s*([\s\S]*?)(?:document\.getElementById\('admin-logout'\)[^\n]+\n\s*)?\s*\}\);/g;

let changed = 0;
files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;

  content = content.replace(RE, (match, body) => {
    // Limpiar la sección de cuerpo — eliminar la línea de logout si quedó
    const lines = body.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('document.getElementById(\'admin-logout\')'));
    const loadCalls = lines.join('\n    ');
    return `adminReady(() => {\n    ${loadCalls}\n  });`;
  });

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Actualizado: ${path.basename(filePath)}`);
    changed++;
  } else {
    console.log(`⏭  Sin cambios: ${path.basename(filePath)}`);
  }
});

console.log(`\n🎉 ${changed} archivo(s) actualizados.`);
