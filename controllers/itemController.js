// controllers/itemController.js
const mongoose = require("mongoose");
const Item = require("../models/Item");
const Log = require("../models/Log");

exports.createItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, stockGudang = 0, asal } = req.body;

    const newItem = await Item.create(
      [
        {
          name,
          stockGudang: Number(stockGudang),
          stockEtalase: 0,
          asal: asal,
        },
      ],
      { session },
    );

    const item = newItem[0];

    // Log input jika ada stockGudang > 0
    if (item.stockGudang > 0) {
      await Log.create(
        [
          {
            itemId: item._id,
            itemName: item.name,
            type: "input",
            jumlah: item.stockGudang,
            asal: asal,
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(item);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("createItem error:", err);
    res.status(500).json({ message: "Gagal tambah item", error: err.message });
  }

  console.log("BODY:", req.body);
};

// GET items with pagination and optional search
exports.getItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {
      name: { $regex: search, $options: "i" },
    };

    const totalItems = await Item.countDocuments(query);
    const items = await Item.find(query).skip(skip).limit(limit);

    res.json({
      items,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (err) {
    console.error("getItems error:", err);
    res.status(500).json({ error: "Gagal mengambil items" });
  }
};

// MUTASI: gudang -> etalase (atomic transaction)
exports.mutasiGudang = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const jumlah = Number(req.body.jumlah);

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Jumlah tidak valid" });
    }

    const item = await Item.findById(id).session(session);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.stockGudang < jumlah) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Stok gudang tidak cukup" });
    }

    // Atomic update menggunakan $inc
    await Item.updateOne(
      { _id: id },
      { $inc: { stockGudang: -jumlah, stockEtalase: jumlah } },
      { session },
    );

    await Log.create(
      [
        {
          itemId: item._id,
          itemName: item.name,
          type: "mutasi",
          asal: item.asal,
          jumlah,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const updated = await Item.findById(id);
    res.json(updated);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("mutasiGudang error:", err);
    res.status(500).json({ error: "Gagal mutasi gudang", detail: err.message });
  }
};

// PENJUALAN: etalase -> keluar (atomic)
exports.penjualan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const jumlah = Number(req.body.jumlah);

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Jumlah tidak valid" });
    }

    const item = await Item.findById(id).session(session);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.stockEtalase < jumlah) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Stok etalase tidak cukup" });
    }

    await Item.updateOne(
      { _id: id },
      { $inc: { stockEtalase: -jumlah } },
      { session },
    );

    await Log.create(
      [
        {
          itemId: item._id,
          itemName: item.name,
          type: "penjualan",
          asal: item.asal,
          jumlah,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const updated = await Item.findById(id);
    res.json(updated);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("penjualan error:", err);
    res.status(500).json({ error: "Gagal penjualan", detail: err.message });
  }
};

// updateItem: name, image, addStockGudang (atomic)
exports.updateItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { name, addStockGudang, asal } = req.body;

    const item = await Item.findById(id).session(session);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item tidak ditemukan" });
    }

    if (name) item.name = name;

    // handle addStockGudang as integer delta (can be positive)
    if (
      addStockGudang !== undefined &&
      addStockGudang !== null &&
      addStockGudang !== ""
    ) {
      const tambahan = Number(addStockGudang);
      if (!Number.isFinite(tambahan)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "addStockGudang tidak valid" });
      }

      // if tambahan negative, ensure stock won't go negative
      if (tambahan < 0 && item.stockGudang + tambahan < 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Stok tidak boleh negatif" });
      }

      // atomic increment
      await Item.updateOne(
        { _id: id },
        { $inc: { stockGudang: tambahan } },
        { session },
      );

      // save log for this adjustment (type: input for +ve, pengurangan for -ve)
      if (tambahan !== 0) {
        await Log.create(
          [
            {
              itemId: item._id,
              itemName: name || item.name,
              type: tambahan > 0 ? "input" : "pengurangan",
              jumlah: Math.abs(tambahan),
              asal: asal,
            },
          ],
          { session },
        );
      }
    } else {
      // if no stock change, persist name/image change by saving item doc directly
      await item.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    const updated = await Item.findById(id);
    res.json(updated);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("updateItem error:", err);
    res.status(500).json({ error: "Gagal update item", detail: err.message });
  }
};

// deleteItem (just delete item and its image) - no transaction needed, but safe to use one
exports.deleteItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const item = await Item.findById(req.params.id).session(session);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item tidak ditemukan" });
    }

    await Item.deleteOne({ _id: item._id }, { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Item berhasil dihapus" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteItem error:", err);
    res.status(500).json({ error: "Gagal menghapus item" });
  }
};

exports.transferGudang = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const jumlah = Number(req.body.jumlah);
    const tujuan = req.body.tujuan;

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Jumlah tidak valid" });
    }

    if (!tujuan) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Tujuan gerai wajib dipilih" });
    }

    const item = await Item.findById(id).session(session);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item tidak ditemukan" });
    }

    if (item.stockGudang < jumlah) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Stok gudang tidak cukup" });
    }

    // kurangi stok gudang saja
    await Item.updateOne(
      { _id: id },
      { $inc: { stockGudang: -jumlah } },
      { session }
    );

    // simpan log transfer
    await Log.create(
      [
        {
          itemId: item._id,
          itemName: item.name,
          type: "transfer",
          jumlah,
          asal: item.asal,
          tujuan: tujuan,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const updated = await Item.findById(id);
    res.json(updated);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("transferGudang error:", err);
    res.status(500).json({ error: "Gagal transfer stok", detail: err.message });
  }
};
