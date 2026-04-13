const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    itemName: String,
    type: {
      type: String,
      enum: ["input", "mutasi", "penjualan", "transfer", "pengurangan"],
      required: true,
    },
    asal: String,
    tujuan: String,
    jumlah: { type: Number, required: true }, // ✅ WAJIB
  },
  { timestamps: true },
);

module.exports = mongoose.model("Log", logSchema);
