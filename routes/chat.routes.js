const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const auth = require('../middlewares/auth');

router.post('/send', auth, chatController.sendMessage);
router.get('/messages/:userId', auth, chatController.getMessages);

module.exports = router; 