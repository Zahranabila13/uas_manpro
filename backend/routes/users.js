const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

// GET /api/users  (Admin only)
router.get("/", verifyToken, requireRole("Admin"), (req, res) => {
    const users = db.readAll("users").map(({ passwordHash, ...safe }) => safe);
    res.json(users);
});

// DELETE /api/users/:id (Admin only)
router.delete("/:id", verifyToken, requireRole("Admin"), (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
        return res.status(400).json({ message: "Tidak bisa menghapus akun sendiri." });
    }
    let users = db.readAll("users");
    const before = users.length;
    users = users.filter((u) => u.id !== id);
    if (users.length === before) {
        return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }
    db.writeAll("users", users);
    res.json({ message: "Pengguna berhasil dihapus." });
});

module.exports = router;