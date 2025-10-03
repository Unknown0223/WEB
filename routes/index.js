// routes/index.js

const express = require('express');
const router = express.Router();

// Barcha routerlarni import qilish va ularni to'g'ri yo'llarga ulash
router.use(require('./auth.js'));
router.use('/users', require('./users.js'));
router.use('/sessions', require('./sessions.js'));
router.use('/reports', require('./reports.js'));
router.use('/settings', require('./settings.js'));
router.use('/pivot-templates', require('./pivot.js'));
router.use('/dashboard', require('./dashboard.js'));
router.use('/roles', require('./roles.js')); // QO'SHILDI

module.exports = router;
