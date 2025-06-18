const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const auth = require('../middlewares/auth');

router.post('/send', auth, notificationController.sendNotification);

module.exports = router; 