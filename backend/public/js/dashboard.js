// dashboard.js — logika utama aplikasi setelah login

const user = getUser();
if (!user || !getToken()) {
    window.location.href = "index.html";
}

const ROLE_LABEL = { Admin: "Admin", Guru: "Guru", Siswa: "Siswa", OrangTua: "Orang Tua" };
const ROLE_TAG_CLASS = { Admin: "tag-admin", Guru: "tag-guru", Siswa: "tag-siswa", OrangTua: "tag-orangtua" };
let questionCounter = 0;
const activeCharts = [];

// ---------- Inisialisasi ----------
document.getElementById("userNama").textContent = user.nama;
document.getElementById("userRoleTag").textContent = ROLE_LABEL[user.role];
document.getElementById("avatarInitial").textContent = user.nama.charAt(0).toUpperCase();

buildNav();
switchSection("ringkasan");
loadRingkasan();

function logout() {
    clearSession();
    window.location.href = "index.html";
}

// ---------- Navigasi berbasis peran (RBAC di sisi tampilan) ----------
function buildNav() {
    const items = [{ id: "ringkasan", label: "Ringkasan", icon: "🏠" }];

    if (user.role === "Admin") {
        items.push({ id: "pengguna", label: "Kelola Pengguna", icon: "👥" });
        items.push({ id: "buat-survei", label: "Buat Survei", icon: "📝" });
        items.push({ id: "survei", label: "Semua Survei", icon: "📊" });
    } else if (user.role === "Guru") {
        items.push({ id: "survei", label: "Dashboard Hasil", icon: "📊" });
    } else {
        items.push({ id: "survei", label: "Isi Survei", icon: "🗳️" });
    }

    const nav = document.getElementById("navContainer");
    nav.innerHTML = items
        .map((it) => `<div class="nav-item" data-id="${it.id}" onclick="switchSection('${it.id}')"><span>${it.icon}</span><span>${it.label}</span></div>`)
        .join("");
}

function switchSection(id) {
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    document.getElementById("section-" + id).classList.add("active");
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.id === id));

    if (id === "ringkasan") loadRingkasan();
    if (id === "pengguna") loadPengguna();
    if (id === "survei") loadSurveyList();

    const titleMap = {
        survei: user.role === "Admin" ? ["Semua Survei", "Kelola survei, lihat hasil, dan ekspor laporan."]
            : user.role === "Guru" ? ["Dashboard Hasil Survei", "Pantau tren kepuasan secara real-time."]
                : ["Isi Survei", "Survei yang tersedia untuk Anda isi."],
    };
    if (titleMap[id]) {
        document.getElementById("surveiSectionTitle").textContent = titleMap[id][0];
        document.getElementById("surveiSectionDesc").textContent = titleMap[id][1];
    }
}

function toast(message, type = "success") {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className = "toast " + type;
    el.style.display = "block";
    setTimeout(() => (el.style.display = "none"), 3200);
}

function closeModal(id) { document.getElementById(id).classList.remove("active"); }
function openModal(id) { document.getElementById(id).classList.add("active"); }

// ---------- RINGKASAN ----------
async function loadRingkasan() {
    try {
        const surveys = await api("/surveys");
        const banner = document.getElementById("notifBanner");
        const stats = document.getElementById("statCards");
        const listBox = document.getElementById("ringkasanSurveyList");

        if (user.role === "Siswa" || user.role === "OrangTua") {
            const belum = surveys.filter((s) => !s.sudahDiisi);
            banner.innerHTML = belum.length
                ? `<div class="notif-banner">🔔 Anda memiliki <strong>${belum.length}</strong> survei yang belum diisi. Jangan lewatkan periode pengisiannya!</div>`
                : "";
            stats.innerHTML = `
        ${statCard(surveys.length, "Survei Tersedia")}
        ${statCard(surveys.filter((s) => s.sudahDiisi).length, "Sudah Diisi")}
        ${statCard(belum.length, "Belum Diisi")}
      `;
        } else {
            banner.innerHTML = "";
            let totalResponden = 0;
            // hitung ringan: minta hasil tiap survei hanya untuk admin/guru (boleh, jumlah survei kecil di simulasi)
            for (const s of surveys) {
                try {
                    const r = await api(`/surveys/${s.id}/results`);
                    totalResponden += r.totalResponden;
                } catch (e) { /* abaikan jika tak berwenang */ }
            }
            stats.innerHTML = `
        ${statCard(surveys.length, "Total Survei")}
        ${statCard(totalResponden, "Total Respon Masuk")}
        ${statCard(surveys.filter((s) => s.status === "active").length, "Survei Aktif")}
      `;
        }

        listBox.innerHTML = surveys.length
            ? surveys.slice(0, 5).map((s) => surveyRow(s)).join("")
            : emptyState("📭", "Belum ada survei yang diterbitkan.");
    } catch (err) {
        toast(err.message, "error");
    }
}

function statCard(num, label) {
    return `<div class="card stat-card"><div class="num">${num}</div><div class="label">${label}</div></div>`;
}

function surveyRow(s) {
    const statusTag = s.sudahDiisi !== undefined
        ? (s.sudahDiisi ? `<span class="tag tag-done">Sudah Diisi</span>` : `<span class="tag tag-todo">Belum Diisi</span>`)
        : "";
    return `<div class="survey-card">
    <div>
      <h3>${escapeHtml(s.judul)}</h3>
      <p>${escapeHtml(s.deskripsi || "Tanpa deskripsi")} · ${s.jumlahPertanyaan} pertanyaan · oleh ${escapeHtml(s.createdByNama)}</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">${statusTag}</div>
  </div>`;
}

// ---------- KELOLA PENGGUNA (Admin) ----------
async function loadPengguna() {
    try {
        const users = await api("/users");
        document.getElementById("userTableBody").innerHTML = users.map((u) => `
      <tr>
        <td>${escapeHtml(u.nama)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="tag ${ROLE_TAG_CLASS[u.role]}">${ROLE_LABEL[u.role]}</span></td>
        <td>${new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
        <td>${u.id === user.id ? "" : `<button class="btn-danger btn-sm" onclick="deleteUser(${u.id})">Hapus</button>`}</td>
      </tr>
    `).join("");
    } catch (err) {
        toast(err.message, "error");
    }
}

async function deleteUser(id) {
    if (!confirm("Hapus pengguna ini?")) return;
    try {
        await api(`/users/${id}`, { method: "DELETE" });
        toast("Pengguna berhasil dihapus.");
        loadPengguna();
    } catch (err) {
        toast(err.message, "error");
    }
}

// ---------- BUAT SURVEI (Admin) ----------
document.getElementById("addQuestionBtn")?.addEventListener("click", () => addQuestionBlock());
addInitialQuestions();

function addInitialQuestions() {
    if (document.getElementById("questionList")) {
        addQuestionBlock("likert");
        addQuestionBlock("essay");
    }
}

function addQuestionBlock(defaultType = "likert") {
    questionCounter++;
    const qid = questionCounter;
    const wrap = document.createElement("div");
    wrap.className = "question-block";
    wrap.dataset.qid = qid;
    wrap.innerHTML = `
    <div class="q-top">
      <select onchange="onQuestionTypeChange(${qid}, this.value)" style="max-width:190px;">
        <option value="likert" ${defaultType === "likert" ? "selected" : ""}>Skala Likert 1–5</option>
        <option value="pilihan_ganda" ${defaultType === "pilihan_ganda" ? "selected" : ""}>Pilihan Ganda</option>
        <option value="essay" ${defaultType === "essay" ? "selected" : ""}>Essay Singkat</option>
      </select>
      <button type="button" class="remove-q" onclick="removeQuestionBlock(${qid})">✕ Hapus</button>
    </div>
    <input type="text" placeholder="Tulis pertanyaan..." class="q-text" required />
    <div class="q-options" style="margin-top:8px;"></div>
  `;
    document.getElementById("questionList").appendChild(wrap);
    onQuestionTypeChange(qid, defaultType);
}

function removeQuestionBlock(qid) {
    document.querySelector(`.question-block[data-qid="${qid}"]`)?.remove();
}

function onQuestionTypeChange(qid, type) {
    const block = document.querySelector(`.question-block[data-qid="${qid}"]`);
    const optWrap = block.querySelector(".q-options");
    if (type === "pilihan_ganda") {
        optWrap.innerHTML = `
      <div class="mc-editor">
        <input type="text" class="mc-input" placeholder="Opsi 1" style="margin-bottom:6px;" />
        <input type="text" class="mc-input" placeholder="Opsi 2" style="margin-bottom:6px;" />
      </div>
      <button type="button" class="btn-ghost btn-sm" onclick="addMcOption(${qid})">+ Tambah Opsi</button>
    `;
    } else {
        optWrap.innerHTML = "";
    }
}

function addMcOption(qid) {
    const block = document.querySelector(`.question-block[data-qid="${qid}"]`);
    const editor = block.querySelector(".mc-editor");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "mc-input";
    input.placeholder = `Opsi ${editor.children.length + 1}`;
    input.style.marginBottom = "6px";
    editor.appendChild(input);
}

document.getElementById("surveyForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("surveyFormError");
    errBox.style.display = "none";

    const judul = document.getElementById("surveyJudul").value.trim();
    const deskripsi = document.getElementById("surveyDeskripsi").value.trim();

    const blocks = document.querySelectorAll(".question-block");
    const questions = [];
    for (const b of blocks) {
        const type = b.querySelector("select").value;
        const text = b.querySelector(".q-text").value.trim();
        if (!text) continue;
        const q = { type, text };
        if (type === "pilihan_ganda") {
            q.options = Array.from(b.querySelectorAll(".mc-input")).map((i) => i.value.trim()).filter(Boolean);
        }
        questions.push(q);
    }

    if (questions.length === 0) {
        errBox.textContent = "Tambahkan minimal 1 pertanyaan.";
        errBox.style.display = "block";
        return;
    }

    try {
        await api("/surveys", { method: "POST", body: { judul, deskripsi, questions } });
        toast("Survei berhasil diterbitkan!");
        document.getElementById("surveyForm").reset();
        document.getElementById("questionList").innerHTML = "";
        addInitialQuestions();
        switchSection("survei");
    } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = "block";
    }
});

// ---------- DAFTAR SURVEI ----------
async function loadSurveyList() {
    try {
        const surveys = await api("/surveys");
        const box = document.getElementById("surveyListContainer");
        if (!surveys.length) {
            box.innerHTML = emptyState("📭", "Belum ada survei yang diterbitkan.");
            return;
        }

        if (user.role === "Admin" || user.role === "Guru") {
            box.innerHTML = surveys.map((s) => `
        <div class="survey-card">
          <div>
            <h3>${escapeHtml(s.judul)}</h3>
            <p>${escapeHtml(s.deskripsi || "Tanpa deskripsi")} · ${s.jumlahPertanyaan} pertanyaan · oleh ${escapeHtml(s.createdByNama)}</p>
          </div>
          <button class="btn-primary btn-sm" onclick="openResultModal(${s.id})">Lihat Hasil</button>
        </div>
      `).join("");
        } else {
            box.innerHTML = surveys.map((s) => `
        <div class="survey-card">
          <div>
            <h3>${escapeHtml(s.judul)}</h3>
            <p>${escapeHtml(s.deskripsi || "Tanpa deskripsi")} · ${s.jumlahPertanyaan} pertanyaan</p>
          </div>
          ${s.sudahDiisi
                    ? `<span class="tag tag-done">✓ Sudah Diisi</span>`
                    : `<button class="btn-amber btn-sm" onclick="openFillModal(${s.id})">Isi Survei</button>`}
        </div>
      `).join("");
        }
    } catch (err) {
        toast(err.message, "error");
    }
}

// ---------- ISI SURVEI (Siswa/OrangTua) ----------
let currentFillSurvey = null;

async function openFillModal(surveyId) {
    try {
        const survey = await api(`/surveys/${surveyId}`);
        currentFillSurvey = survey;
        document.getElementById("fillSurveyTitle").textContent = survey.judul;
        document.getElementById("fillSurveyDesc").textContent = survey.deskripsi || "";

        document.getElementById("fillQuestions").innerHTML = survey.questions.map((q) => {
            if (q.type === "likert") {
                return `<div class="question-block" data-qid="${q.id}" data-type="likert">
          <div class="q-top"><strong>${escapeHtml(q.text)}</strong></div>
          <div class="likert-row">
            ${[1, 2, 3, 4, 5].map(n => `<div class="likert-opt" data-val="${n}" onclick="selectLikert(${q.id}, ${n})">${n}<br/><span style="font-size:10px;">${likertLabel(n)}</span></div>`).join("")}
          </div>
        </div>`;
            }
            if (q.type === "pilihan_ganda") {
                return `<div class="question-block" data-qid="${q.id}" data-type="pilihan_ganda">
          <div class="q-top"><strong>${escapeHtml(q.text)}</strong></div>
          ${(q.options || []).map(opt => `<div class="mc-opt" data-val="${escapeHtml(opt)}" onclick="selectMc(${q.id}, this)">${escapeHtml(opt)}</div>`).join("")}
        </div>`;
            }
            return `<div class="question-block" data-qid="${q.id}" data-type="essay">
        <div class="q-top"><strong>${escapeHtml(q.text)}</strong></div>
        <textarea rows="3" placeholder="Tulis jawaban Anda..." class="essay-input"></textarea>
      </div>`;
        }).join("");

        document.getElementById("fillFormError").style.display = "none";
        openModal("fillModal");
    } catch (err) {
        toast(err.message, "error");
    }
}

function likertLabel(n) {
    return { 1: "Sangat Tidak Puas", 2: "Tidak Puas", 3: "Netral", 4: "Puas", 5: "Sangat Puas" }[n];
}

function selectLikert(qid, val) {
    const block = document.querySelector(`#fillQuestions .question-block[data-qid="${qid}"]`);
    block.dataset.value = val;
    block.querySelectorAll(".likert-opt").forEach((el) => el.classList.toggle("selected", Number(el.dataset.val) === val));
}

function selectMc(qid, el) {
    const block = document.querySelector(`#fillQuestions .question-block[data-qid="${qid}"]`);
    block.dataset.value = el.dataset.val;
    block.querySelectorAll(".mc-opt").forEach((o) => o.classList.remove("selected"));
    el.classList.add("selected");
}

document.getElementById("fillSurveyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("fillFormError");
    errBox.style.display = "none";

    const blocks = document.querySelectorAll("#fillQuestions .question-block");
    const answers = [];
    for (const b of blocks) {
        const qid = Number(b.dataset.qid);
        const type = b.dataset.type;
        let value;
        if (type === "essay") value = b.querySelector(".essay-input").value.trim();
        else value = b.dataset.value;

        if (!value) {
            errBox.textContent = "Mohon lengkapi semua pertanyaan sebelum mengirim.";
            errBox.style.display = "block";
            return;
        }
        answers.push({ questionId: qid, value: type === "likert" ? Number(value) : value });
    }

    try {
        await api(`/surveys/${currentFillSurvey.id}/responses`, { method: "POST", body: { answers } });
        toast("Terima kasih! Jawaban Anda telah terkirim.");
        closeModal("fillModal");
        loadSurveyList();
        loadRingkasan();
    } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = "block";
    }
});

// ---------- HASIL SURVEI (Admin/Guru) ----------
let currentResultSurveyId = null;

async function openResultModal(surveyId) {
    try {
        const data = await api(`/surveys/${surveyId}/results`);
        currentResultSurveyId = surveyId;
        document.getElementById("resultSurveyTitle").textContent = data.survey.judul;
        document.getElementById("resultRespondenCount").textContent = `${data.totalResponden} responden telah mengisi survei ini`;

        activeCharts.forEach((c) => c.destroy());
        activeCharts.length = 0;

        const body = document.getElementById("resultBody");
        body.innerHTML = data.results.map((r, i) => {
            if (r.type === "likert") {
                return `<div class="question-block">
          <div class="q-top"><strong>${escapeHtml(r.text)}</strong><span class="tag tag-guru">Rata-rata ${r.rataRata} / 5</span></div>
          <div class="chart-wrap"><canvas id="chart-${i}"></canvas></div>
        </div>`;
            }
            if (r.type === "pilihan_ganda") {
                return `<div class="question-block">
          <div class="q-top"><strong>${escapeHtml(r.text)}</strong></div>
          <div class="chart-wrap"><canvas id="chart-${i}"></canvas></div>
        </div>`;
            }
            return `<div class="question-block">
        <div class="q-top"><strong>${escapeHtml(r.text)}</strong><span class="tag tag-guru">${r.totalJawaban} jawaban</span></div>
        ${r.jawabanEssay.length
                    ? `<ul style="margin:0; padding-left:18px; font-size:13.5px; color:var(--text);">${r.jawabanEssay.map(j => `<li>${escapeHtml(j)}</li>`).join("")}</ul>`
                    : `<p style="color:var(--text-muted); font-size:13px;">Belum ada jawaban.</p>`}
      </div>`;
        }).join("");

        data.results.forEach((r, i) => {
            if (r.type === "likert") {
                const ctx = document.getElementById(`chart-${i}`);
                activeCharts.push(new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: ["1 - Sangat Tidak Puas", "2", "3 - Netral", "4", "5 - Sangat Puas"],
                        datasets: [{ data: r.distribusi, backgroundColor: "#0f6e6a", borderRadius: 6 }],
                    },
                    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
                }));
            } else if (r.type === "pilihan_ganda") {
                const ctx = document.getElementById(`chart-${i}`);
                activeCharts.push(new Chart(ctx, {
                    type: "pie",
                    data: {
                        labels: r.distribusi.map((d) => d.opsi),
                        datasets: [{ data: r.distribusi.map((d) => d.jumlah), backgroundColor: ["#0f6e6a", "#e8a33d", "#3452a3", "#c0473b", "#7a3aa8"] }],
                    },
                    options: { plugins: { legend: { position: "bottom" } } },
                }));
            }
        });

        openModal("resultModal");
    } catch (err) {
        toast(err.message, "error");
    }
}

document.getElementById("exportBtn").addEventListener("click", async () => {
    if (!currentResultSurveyId) return;
    try {
        const res = await api(`/surveys/${currentResultSurveyId}/export`, { raw: true });
        if (!res.ok) throw new Error("Gagal mengekspor data.");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hasil-survei-${currentResultSurveyId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast("Laporan CSV berhasil diunduh (bisa dibuka di Excel).");
    } catch (err) {
        toast(err.message, "error");
    }
});

// ---------- Util ----------
function emptyState(icon, text) {
    return `<div class="empty-state"><div class="icon">${icon}</div><p>${text}</p></div>`;
}
function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}