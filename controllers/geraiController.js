const Gerai = require("../models/Gerai");

exports.gerai =  (req, res) => {
  try {
    const gerai = Gerai.find();
    res.json(gerai);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data gerai" });
  }
};
