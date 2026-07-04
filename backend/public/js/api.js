// api.js — pembungkus fetch sederhana dengan token JWT

const API_BASE = "/api";

function getToken() { return localStorage.getItem("token"); }
function getUser() {
    try { return JSON.parse(localStorage.getItem("user")); } catch (e) { return null; }
}
function saveSession(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

async function api(path, { method = "GET", body, raw = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (raw) return res; // untuk download file (CSV)

    let data = null;
    try { data = await res.json(); } catch (e) { /* respon kosong */ }

    if (!res.ok) {
        const message = (data && data.message) || "Terjadi kesalahan pada server.";
        throw new Error(message);
    }
    return data;
}