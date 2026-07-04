const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../db");
const { verifyToken, JWT_SECRET } = require("../middleware/auth");

const ROLES = ["Admin", "Guru", "Siswa", "OrangTua"];

// POST /api/auth/register
router.post("/register", (req, res) => {
    const { nama, email, password, role } = req.body;

    if (!nama || !email || !password || !role) {
        return res.status(400).json({ message: "Semua kolom wajib diisi." });
    }
    if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Peran tidak valid." });
    }

    const users = db.readAll("users");
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        return res.status(409).json({ message: "Email sudah terdaftar." });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = {
        id: db.nextId(users),
        nama,
        email,
        passwordHash,
        role,
        createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    db.writeAll("users", users);

    res.status(201).json({ message: "Registrasi berhasil. Silakan login." });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    const users = db.readAll("users");
    const user = users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());

    if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
        return res.status(401).json({ message: "Email atau kata sandi salah." });
    }

    const payload = { id: user.id, nama: user.nama, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

    res.json({ token, user: payload });
});

// GET /api/auth/me
router.get("/me", verifyToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;