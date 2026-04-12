const mongoose = require("mongoose");

const geraiSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { collection: "gerai" },
);

module.exports = mongoose.model("Gerai", geraiSchema);
