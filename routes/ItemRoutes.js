const express = require('express');
const router = express.Router();
const { createItem, getItems, mutasiGudang, penjualan } = require('../controllers/itemController');
const itemController = require('../controllers/itemController');
const upload = require('../middleware/upload');

router.post('/', upload.single('image'), itemController.createItem);
router.get('/', getItems);
router.put('/mutasi/:id', itemController.mutasiGudang);
router.put('/penjualan/:id', itemController.penjualan);
router.put('/:id', upload.single('image'), itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

module.exports = router;
