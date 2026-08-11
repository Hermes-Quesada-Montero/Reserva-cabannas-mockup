/**
 * Rutas de Autenticación
 */

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  login, register, logout, checkSession, changePassword
} = require('../controllers/authController');

router.post('/login',           login);
router.post('/register',        register);
router.post('/logout',          logout);
router.get('/check-session',    checkSession);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;
