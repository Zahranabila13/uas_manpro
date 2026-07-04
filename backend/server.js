const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const surveyRoutes = require("./routes/surveys");

db.init();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/surveys", surveyRoutes);

// Frontend statis
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`\n✅ Server berjalan di http://localhost:${PORT}`);
    console.log(`   Sistem Dashboard Kepuasan Siswa & Orang Tua Berbasis Web\n`);
});