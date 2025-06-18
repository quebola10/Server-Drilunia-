const express = require('express');
const router = express.Router();
const iceController = require('../controllers/ice.controller');
const auth = require('../middlewares/auth');

router.get('/', auth, iceController.getIceServers);

module.exports = router; 