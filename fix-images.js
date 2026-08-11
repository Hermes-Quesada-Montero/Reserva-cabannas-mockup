/**
 * Script para actualizar URLs de imágenes en la base de datos
 * con fotos reales de Unsplash (sin necesidad de archivos locales)
 * Uso: node fix-images.js
 */
require('dotenv').config();
const BetterSQLite = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/cabanas.db');
const db = new BetterSQLite(DB_PATH);

// Imágenes de cabañas (hero)
const cabanasImgs = {
  1: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1400&q=80', // cabaña pequeña bosque
  2: 'https://images.unsplash.com/photo-1471115853179-bb1d604434e0?w=1400&q=80', // cabaña familiar pinos
  3: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1400&q=80',   // villa premium con deck
};

// Galería: URLs reales por categoría
const galeriaImgs = [
  // Cabaña 1
  { id: 1, url: 'https://images.unsplash.com/photo-1518732714860-b62714ce0c59?w=800&q=80' },  // exterior cabana 1
  { id: 2, url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=80' },  // habitacion 1
  { id: 3, url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80' },  // cocina/sala
  // Cabaña 2
  { id: 4, url: 'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&q=80' },  // exterior pinos
  { id: 5, url: 'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80' },  // habitacion 2a
  { id: 6, url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80' },  // habitacion 2b
  // Cabaña 3
  { id: 7, url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80' },  // piscina
  { id: 8, url: 'https://images.unsplash.com/photo-1504275107627-0c2ba7a43dba?w=800&q=80' },  // jacuzzi
  { id: 9, url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80' },  // sala premium
  { id: 10, url: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800&q=80' }, // deck panoramico
  // General
  { id: 11, url: 'https://images.unsplash.com/photo-1530018352490-c6eef07fd7b8?w=800&q=80' }, // fogata
  { id: 12, url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80' }, // sendero bosque
  { id: 13, url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80' }, // restaurante
  { id: 14, url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' }, // amanecer
  { id: 15, url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80' }, // actividades
];

// Banners del hero
const bannersImgs = [
  { orden: 1, url: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1600&q=85' },
  { orden: 2, url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1600&q=85' },
  { orden: 3, url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=85' },
];

try {
  // Actualizar imagen principal de cada cabaña
  const updCabana = db.prepare('UPDATE cabanas SET imagen_principal = ? WHERE id = ?');
  for (const [id, url] of Object.entries(cabanasImgs)) {
    updCabana.run(url, parseInt(id));
    console.log(`✅ Cabaña ${id}: imagen actualizada`);
  }

  // Actualizar galería
  const updGaleria = db.prepare('UPDATE galeria SET url_imagen = ? WHERE id = ?');
  for (const { id, url } of galeriaImgs) {
    const result = updGaleria.run(url, id);
    if (result.changes > 0) console.log(`✅ Galería ${id}: imagen actualizada`);
  }

  // Actualizar banners
  const updBanner = db.prepare('UPDATE banners SET url_imagen = ? WHERE orden = ?');
  for (const { orden, url } of bannersImgs) {
    const result = updBanner.run(url, orden);
    if (result.changes > 0) console.log(`✅ Banner ${orden}: imagen actualizada`);
  }

  // Verificar
  const cabanas = db.prepare('SELECT id, nombre, imagen_principal FROM cabanas').all();
  console.log('\n📸 Estado de imágenes:');
  cabanas.forEach(c => console.log(`   Cabaña ${c.id} "${c.nombre}": ${c.imagen_principal ? '✅' : '❌ sin imagen'}`));

  console.log('\n🎉 Imágenes actualizadas exitosamente');
  db.close();
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
