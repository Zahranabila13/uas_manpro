const jwt = require("jsonwebtoken");

const JWT_SECRET = "scrum-worksheet-secret-key-ganti-jika-production"; // demo only

function verifyToken(req, res, next) {
    const header = req.headers["authorization"];
    const token = header && header.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Token tidak ditemukan. Silakan login kembali." });
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Token tidak valid atau kedaluwarsa." });
        }
        req.user = decoded; // { id, nama, email, role }
        next();
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Anda tidak memiliki akses ke fitur ini." });
        }
        next();
    };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };