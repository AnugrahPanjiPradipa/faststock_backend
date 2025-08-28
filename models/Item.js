const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String,
  stockGudang: { type: Number, default: 0 },
  stockEtalase: { type: Number, default: 0 }
});

module.exports = mongoose.model('Item', itemSchema);
