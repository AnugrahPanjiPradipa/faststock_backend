const express = require("express");
const router = express.Router();
const {
  createItem,
  getItems,
  mutasiGudang,
  penjualan,
} = require("../controllers/itemController");
const itemController = require("../controllers/itemController");

router.post("/", itemController.createItem);
router.get("/", getItems);
router.put("/:id", itemController.updateItem);
router.put("/mutasi/:id", itemController.mutasiGudang);
router.put("/penjualan/:id", itemController.penjualan);
router.delete("/:id", itemController.deleteItem);
router.put("/transfer/:id", itemController.transferGudang);

module.exports = router;
