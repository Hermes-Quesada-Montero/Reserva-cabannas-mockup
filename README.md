# 🌲 Cabañas Los Pinos — Sistema de Reservación

Sistema web completo de reservación de cabañas. Incluye sitio público, panel administrativo, autenticación, reservaciones con pago, PDF, código QR, calendario ICS y base de datos SQLite integrada.

---

## 🚀 Inicio rápido

### 1. Requisitos

- **Node.js** v14 o superior
- **npm** v6 o superior

Verificar instalación:
```bash
node --version
npm --version
```

### 2. Instalar dependencias

```bash
cd cabanas-project
npm install
```

### 3. Configurar variables de entorno (opcional)

Copia el archivo de ejemplo y edita las variables:
```bash
copy .env.example .env
```

Edita `.env` con tu editor de texto. Los valores por defecto funcionan sin configuración adicional.

### 4. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo con auto-reinicio:
```bash
npm run dev
```

### 5. Acceder al sistema

| Recurso | URL |
|---------|-----|
| Sitio web público | http://localhost:3000 |
| Panel administrativo | http://localhost:3000/admin |

**Credenciales del administrador:**
- Usuario: `admin123`
- Contraseña: `1234qwer`

---

## 📁 Estructura del proyecto

```
cabanas-project/
├── .env.example          ← Configuración de entorno (copiar a .env)
├── package.json
├── backend/
│   ├── server.js         ← Servidor Express (punto de entrada)
│   ├── database/
│   │   ├── db.js         ← Singleton SQLite + helpers
│   │   ├── schema.js     ← Definición de todas las tablas
│   │   ├── seed.js       ← Datos iniciales de ejemplo
│   │   └── init.js       ← Inicialización automática + migraciones
│   ├── controllers/
│   │   ├── authController.js          ← Login, registro, sesiones
│   │   ├── cabanasController.js       ← API pública de cabañas
│   │   ├── reservacionesController.js ← Flujo completo de reservación
│   │   ├── clienteController.js       ← Perfil, comentarios, contacto
│   │   └── adminController.js         ← CRUD completo (panel admin)
│   ├── middleware/
│   │   └── auth.js       ← requireAuth, requireAdmin, attachUser
│   ├── routes/
│   │   ├── auth.js       ← /api/auth/*
│   │   ├── cabanas.js    ← /api/cabanas/*
│   │   ├── reservaciones.js ← /api/reservaciones/*
│   │   ├── cliente.js    ← /api/* (público + cliente autenticado)
│   │   └── admin.js      ← /api/admin/* (solo admin)
│   └── services/
│       ├── pdfService.js ← Genera PDF de reservación (PDFKit)
│       ├── qrService.js  ← Genera código QR (qrcode)
│       └── icsService.js ← Genera archivo de calendario (.ics)
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   ├── main.css    ← Estilos sitio público
│   │   │   └── admin.css   ← Estilos panel admin
│   │   ├── js/
│   │   │   ├── main.js     ← JS compartido: API, Toast, Auth, Navbar
│   │   │   ├── calendario.js ← Widget calendario de disponibilidad
│   │   │   └── admin.js    ← JS compartido panel admin
│   │   └── uploads/        ← Archivos subidos (comprobantes SINPE)
│   └── views/
│       ├── index.html          ← Página principal
│       ├── cabanas.html        ← Listado de cabañas
│       ├── cabana-detalle.html ← Detalle de cabaña
│       ├── reservar.html       ← Wizard de reservación (3 pasos)
│       ├── galeria.html        ← Galería con lightbox
│       ├── faq.html            ← Preguntas frecuentes
│       ├── contacto.html       ← Formulario de contacto
│       ├── politicas.html      ← Políticas del establecimiento
│       ├── 404.html            ← Página de error 404
│       ├── client/
│       │   ├── login.html              ← Inicio de sesión
│       │   ├── registro.html           ← Crear cuenta
│       │   ├── mi-cuenta.html          ← Perfil del cliente
│       │   ├── mis-reservaciones.html  ← Historial de reservaciones
│       │   ├── reservacion-detalle.html ← Detalle de una reservación
│       │   ├── pago.html               ← Página de pago
│       │   └── confirmacion.html       ← Confirmación con QR/PDF/ICS
│       └── admin/
│           ├── login.html        ← Login exclusivo del administrador
│           ├── dashboard.html    ← Estadísticas y gráficas
│           ├── reservaciones.html ← CRUD reservaciones
│           ├── cabanas.html      ← CRUD cabañas
│           ├── tarifas.html      ← CRUD tarifas
│           ├── usuarios.html     ← CRUD clientes/usuarios
│           ├── galeria.html      ← CRUD galería
│           ├── banners.html      ← CRUD banners hero
│           ├── comentarios.html  ← Moderación de reseñas
│           ├── faqs.html         ← CRUD preguntas frecuentes
│           ├── cupones.html      ← CRUD cupones de descuento
│           ├── disponibilidad.html ← Gestión de bloqueos
│           ├── mensajes.html     ← Bandeja de mensajes de contacto
│           ├── politicas.html    ← Editor de políticas
│           ├── contacto.html     ← Info de contacto y redes sociales
│           └── configuracion.html ← Configuración general del sitio
└── data/                 ← Base de datos SQLite (se crea automáticamente)
    └── cabanas.db
```

---

## 🏠 Cabañas y tarifas

| Cabaña | Habitaciones | 1 persona | 2 personas | 3 personas |
|--------|-------------|-----------|------------|------------|
| Cabaña 1 | 1 | $50/noche | $75/noche | — |
| Cabaña 2 | 2 | $100/noche | $150/noche | $175/noche |
| Cabaña 3 🏊 | 2 + piscina | $140/noche | $190/noche | $215/noche |

> Los menores de 10 años **no generan costo** pero deben registrarse por seguridad.

---

## 💳 Métodos de pago

| Método | Estado | Notas |
|--------|--------|-------|
| Tarjeta (Stripe) | ✅ Preparado | Requiere credenciales reales en `.env` |
| SINPE Móvil | ✅ Funcional | Número ficticio: 8888-8888. Permite subir comprobante |
| Pago al llegar | ✅ Funcional | Genera reserva pendiente de confirmación |

### Activar Stripe (producción)
Edita el archivo `.env`:
```env
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

---

## 📧 Configurar envío de correos (opcional)

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tucorreo@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_FROM=Cabañas Los Pinos <tucorreo@gmail.com>
```

---

## 🔐 Seguridad

- Contraseñas cifradas con **bcrypt** (12 rounds)
- Sesiones con **express-session**
- Protección **Helmet** (headers HTTP seguros)
- Rate limiting en endpoints de autenticación (20 intentos / 15 min)
- Validación de entradas en todos los formularios
- Protección contra SQL Injection (sentencias preparadas)
- Roles de usuario: `admin` y `cliente`

---

## 🛠️ Scripts disponibles

```bash
npm start       # Inicia en producción
npm run dev     # Inicia con nodemon (recarga automática)
```

---

## 📊 API endpoints principales

### Públicos
- `GET /api/cabanas` — Listar cabañas
- `GET /api/cabanas/:id` — Detalle de cabaña
- `GET /api/cabanas/:id/disponibilidad` — Fechas disponibles
- `GET /api/faqs` — Preguntas frecuentes
- `GET /api/galeria` — Galería de imágenes
- `GET /api/politicas` — Políticas del sitio
- `POST /api/contacto` — Enviar mensaje de contacto

### Autenticación
- `POST /api/auth/login` — Iniciar sesión
- `POST /api/auth/registro` — Crear cuenta
- `POST /api/auth/logout` — Cerrar sesión
- `GET /api/auth/me` — Verificar sesión activa

### Cliente (requiere sesión)
- `GET /api/mis-reservaciones` — Mis reservaciones
- `GET /api/mis-reservaciones/:id` — Detalle
- `POST /api/reservaciones` — Crear reservación
- `POST /api/reservaciones/:id/cancelar` — Cancelar
- `GET /api/reservaciones/:id/pdf` — Descargar PDF
- `GET /api/reservaciones/:id/ics` — Descargar .ics

### Admin (requiere rol admin)
- `GET /api/admin/dashboard` — Estadísticas
- `GET|POST|PUT|DELETE /api/admin/cabanas`
- `GET|POST|PUT|DELETE /api/admin/tarifas`
- `GET|POST|PUT|DELETE /api/admin/reservaciones`
- `GET|POST|PUT|DELETE /api/admin/galeria`
- `GET|POST|PUT|DELETE /api/admin/faqs`
- `GET|POST|PUT|DELETE /api/admin/cupones`
- `GET|POST|PUT|DELETE /api/admin/banners`
- `GET|POST|PUT|DELETE /api/admin/politicas`
- `GET|PUT /api/admin/configuracion`
- `GET|PUT /api/admin/mensajes/:id`
- `GET|POST|DELETE /api/admin/bloqueos`
- `GET|PUT /api/admin/clientes/:id`

---

## 🌐 Despliegue en producción

1. Establecer `NODE_ENV=production` en `.env`
2. Configurar `SESSION_SECRET` con una cadena larga y aleatoria
3. Usar **HTTPS** (`cookie.secure = true`)
4. Configurar un proxy reverso (Nginx/Apache)

Ejemplo `.env` producción:
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=clave-super-secreta-aleatoria-larga-aqui
```

---

## 📝 Datos de ejemplo incluidos

El sistema viene con datos preconfigurados:
- ✅ 1 administrador (`admin123` / `1234qwer`)
- ✅ 3 clientes ficticios con reservaciones
- ✅ 3 cabañas con tarifas configuradas
- ✅ Galería de imágenes (URLs de Unsplash)
- ✅ 10 FAQs de ejemplo
- ✅ Comentarios y calificaciones
- ✅ Cupones de descuento de ejemplo
- ✅ Banners del hero

---

## ❓ Problemas comunes

**El servidor no inicia:**
```bash
# Reinstalar dependencias
rm -rf node_modules
npm install
```

**Error de base de datos:**
```bash
# Eliminar la BD y reiniciar (recreará con datos de ejemplo)
del data\cabanas.db
npm start
```

**Puerto en uso:**
```env
# Cambiar el puerto en .env
PORT=3001
```

---

*Desarrollado con ❤️ — Cabañas Los Pinos © 2024*
