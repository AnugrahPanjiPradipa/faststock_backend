const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stockGudang: { type: Number, default: 0 },
  stockEtalase: { type: Number, default: 0 },
  asal: { type: String },
});

module.exports = mongoose.model("Item", itemSchema);
