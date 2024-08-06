import AppController from '../controllers/AppController';

const express = require('express');

const router = express.Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.get('/ooga', AppController.getOoga);

module.exports = router;
