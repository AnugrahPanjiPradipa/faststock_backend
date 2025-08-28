const Log = require('../models/Log');
const Item = require('../models/Item');
const ExcelJS = require('exceljs');

exports.getLogs = async (req, res) => {
  const { date, type } = req.query;
  let filter = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }

  if (type && type !== 'all') {
    filter.type = type;
  }

  try {
    const logs = await Log.find(filter).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Gagal ambil log' });
  }
};

// GET /api/logs/export?date=2025-08-05
exports.exportLogsToExcel = async (req, res) => {
  const { date } = req.query;
  let filter = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }

  const logs = await Log.find(filter).sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Log');

  sheet.columns = [
    { header: 'Tanggal', key: 'createdAt', width: 20 },
    { header: 'Item', key: 'itemName', width: 25 },
    { header: 'Jenis', key: 'type', width: 15 },
    { header: 'Jumlah', key: 'jumlah', width: 10 },
  ];

  logs.forEach((log) => {
    sheet.addRow({
      createdAt: log.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      itemName: log.itemName,
      type: log.type,
      jumlah: log.jumlah,
    });
  });

  res.setHeader('Content-Disposition', `attachment; filename=log-${date || 'all'}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  await workbook.xlsx.write(res);
  res.end();
};

exports.deleteLogsByDate = async (req, res) => {
  const { date } = req.body;

  if (!date) return res.status(400).json({ message: 'Tanggal wajib diisi' });

  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  try {
    const result = await Log.deleteMany({
      createdAt: { $gte: start, $lt: end },
    });
    res.json({ message: `Berhasil hapus ${result.deletedCount} log` });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus log', error: err.message });
  }
};

exports.deleteLogAndRollback = async (req, res) => {
  const { id } = req.params;

  try {
    const log = await Log.findById(id);
    if (!log) return res.status(404).json({ message: 'Log tidak ditemukan' });

    if (!log.itemId) {
      await log.deleteOne();
      return res.json({ message: 'Log dihapus (tanpa rollback stok karena tidak ada itemId)' });
    }

    const item = await Item.findById(log.itemId);
    if (!item) {
      await log.deleteOne(); // kalau item udah gak ada, tetap hapus log
      return res.status(404).json({ message: 'Item tidak ditemukan, log dihapus' });
    }

    // 🔁 Rollback stok berdasarkan tipe log
    switch (log.type) {
      case 'input':
        item.stockGudang -= log.jumlah;
        break;
      case 'mutasi':
        item.stockGudang += log.jumlah;
        item.stockEtalase -= log.jumlah;
        break;
      case 'penjualan':
        item.stockEtalase += log.jumlah;
        break;
      default:
        break;
    }

    // Jangan sampai minus stok
    item.stockGudang = Math.max(item.stockGudang, 0);
    item.stockEtalase = Math.max(item.stockEtalase, 0);

    // Simpan perubahan stok
    await item.save();

    // Hapus log
    await log.deleteOne();

    // ❌ Jika stok habis semua, hapus item juga
    if (item.stockGudang <= 0 && item.stockEtalase <= 0) {
      await Item.findByIdAndDelete(item._id);
      return res.json({ message: 'Log dihapus, stok rollback, item juga dihapus karena stok habis' });
    }

    res.json({ message: 'Log berhasil dihapus dan stok dikembalikan' });
  } catch (error) {
    console.error('Gagal menghapus log:', error);
    res.status(500).json({ message: 'Gagal menghapus log' });
  }
};

exports.updateLogAndAdjustStock = async (req, res) => {
  const { id } = req.params;
  const { itemId, itemName, type, jumlah } = req.body;

  try {
    const log = await Log.findById(id);
    if (!log) return res.status(404).json({ message: 'Log tidak ditemukan' });

    const item = await Item.findById(itemId || log.itemId);
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });

    // 1️⃣ Rollback stok lama sesuai log lama
    if (log.type === 'input') {
      item.stockGudang -= log.jumlah;
    } else if (log.type === 'mutasi') {
      item.stockGudang += log.jumlah;
      item.stockEtalase -= log.jumlah;
    } else if (log.type === 'penjualan') {
      item.stockEtalase += log.jumlah;
    }

    // 2️⃣ Validasi stok sebelum update
    if (type === 'mutasi' && item.stockGudang < jumlah) {
      return res.status(400).json({ message: 'Stok gudang tidak cukup' });
    }
    if (type === 'penjualan' && item.stockEtalase < jumlah) {
      return res.status(400).json({ message: 'Stok etalase tidak cukup' });
    }

    // 3️⃣ Terapkan stok baru sesuai log baru
    if (type === 'input') {
      item.stockGudang += jumlah;
    } else if (type === 'mutasi') {
      item.stockGudang -= jumlah;
      item.stockEtalase += jumlah;
    } else if (type === 'penjualan') {
      item.stockEtalase -= jumlah;
    }

    // 4️⃣ Simpan perubahan log
    log.itemId = itemId || log.itemId;
    log.itemName = itemName || log.itemName;
    log.type = type || log.type;
    log.jumlah = jumlah || log.jumlah;

    await item.save();
    await log.save();

    // 5️⃣ Jika stok semua habis, hapus item
    if (item.stockGudang <= 0 && item.stockEtalase <= 0) {
      await Item.findByIdAndDelete(item._id);
    }

    res.json({ message: 'Log berhasil diedit dan stok diperbarui' });
  } catch (error) {
    console.error('Gagal edit log:', error);
    res.status(500).json({ message: 'Gagal edit log', error: error.message });
  }
};
