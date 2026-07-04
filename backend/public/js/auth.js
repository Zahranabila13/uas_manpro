// auth.js — logika halaman login & registrasi

if (getToken()) {
    window.location.href = "dashboard.html";
}

function switchTab(tab) {
    const isLogin = tab === "login";
    document.getElementById("tabLogin").classList.toggle("active", isLogin);
    document.getElementById("tabRegister").classList.toggle("active", !isLogin);
    document.getElementById("loginForm").style.display = isLogin ? "block" : "none";
    document.getElementById("registerForm").style.display = isLogin ? "none" : "block";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("loginError");
    errorBox.style.display = "none";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const data = await api("/auth/login", { method: "POST", body: { email, password } });
        saveSession(data.token, data.user);
        window.location.href = "dashboard.html";
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    }
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("registerError");
    const successBox = document.getElementById("registerSuccess");
    errorBox.style.display = "none";
    successBox.style.display = "none";

    const nama = document.getElementById("regNama").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const role = document.getElementById("regRole").value;

    try {
        await api("/auth/register", { method: "POST", body: { nama, email, password, role } });
        successBox.textContent = "Registrasi berhasil! Silakan masuk dengan akun baru Anda.";
        successBox.style.display = "block";
        document.getElementById("registerForm").reset();
        setTimeout(() => switchTab("login"), 1200);
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = "block";
    }
});