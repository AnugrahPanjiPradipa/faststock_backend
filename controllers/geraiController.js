const Gerai = require("../models/Gerai");

exports.gerai = async (req, res) => {
  try {
    const gerai = await Gerai.find();
    res.json(gerai);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data gerai" });
  }
};
