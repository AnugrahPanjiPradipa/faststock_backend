const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

router.get('/', logController.getLogs);
router.get('/export', logController.exportLogsToExcel);
router.delete('/', logController.deleteLogsByDate);
router.delete('/:id', logController.deleteLogAndRollback);
router.put('/:id', logController.updateLogAndAdjustStock);



module.exports = router;
