const express = require('express');
const router = express.Router();
const emailController = require('../controllers/email.controller');
const auth = require('../middlewares/auth');

router.post('/send', auth, emailController.sendEmail);

module.exports = router; 