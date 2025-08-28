const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    itemName: String,
    type: { type: String, enum: ['input', 'mutasi', 'penjualan'] },
    jumlah: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Log', logSchema);
