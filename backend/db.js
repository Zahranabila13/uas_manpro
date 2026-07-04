// db.js
// Penyimpanan data sederhana berbasis file JSON (pengganti database sungguhan
// agar proyek ini mudah dijalankan tanpa instalasi database tambahan).
// Cocok untuk simulasi Sprint 1: fokus pada fitur, bukan infrastruktur.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    surveys: path.join(DATA_DIR, "surveys.json"),
    responses: path.join(DATA_DIR, "responses.json"),
};

function ensureFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]", "utf-8");
    }
}

function init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    Object.values(FILES).forEach(ensureFile);
}

function readAll(name) {
    ensureFile(FILES[name]);
    const raw = fs.readFileSync(FILES[name], "utf-8");
    try {
        return JSON.parse(raw || "[]");
    } catch (e) {
        return [];
    }
}

function writeAll(name, data) {
    fs.writeFileSync(FILES[name], JSON.stringify(data, null, 2), "utf-8");
}

function nextId(list) {
    return list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
}

module.exports = { init, readAll, writeAll, nextId };