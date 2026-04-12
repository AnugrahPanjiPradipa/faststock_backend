const express = require("express");
const router = express.Router();
const Gerai = require("../models/Gerai");

router.get("/", async (req, res) => {
  try {
    const geraidata = await Gerai.find();
    res.json(geraidata);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data gerai" });
  }
});

module.exports = router;
