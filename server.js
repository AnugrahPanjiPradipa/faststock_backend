const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const logRoutes = require("./routes/logRoutes");
const geraiRoutes = require("./routes/geraiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/items", require("./routes/ItemRoutes"));
app.use("/api/logs", require("./routes/logRoutes"));
app.use("/uploads", express.static("uploads"));
app.use("/api/logs", logRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/gerai", geraiRoutes);

app.get("/", (req, res) => {
  res.send("✅ FastStock Backend is running...");
});

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB", err);
  }
};

startServer();
