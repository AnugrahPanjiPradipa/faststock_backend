const express = require("express");
const geraiController = require("../controllers/geraiController");
const router = express.Router();

router.get("/", geraiController.gerai);

module.exports = router;
