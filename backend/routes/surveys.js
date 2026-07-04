const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

// POST /api/surveys  (Admin) - PB02: buat formulir survei
router.post("/", verifyToken, requireRole("Admin"), (req, res) => {
    const { judul, deskripsi, questions } = req.body;

    if (!judul || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Judul dan minimal 1 pertanyaan wajib diisi." });
    }
    for (const q of questions) {
        if (!q.text || !q.type) {
            return res.status(400).json({ message: "Setiap pertanyaan wajib memiliki teks dan tipe." });
        }
        if (!["likert", "pilihan_ganda", "essay"].includes(q.type)) {
            return res.status(400).json({ message: `Tipe pertanyaan tidak dikenal: ${q.type}` });
        }
    }

    const surveys = db.readAll("surveys");
    const newSurvey = {
        id: db.nextId(surveys),
        judul,
        deskripsi: deskripsi || "",
        status: "active",
        createdBy: req.user.id,
        createdByNama: req.user.nama,
        createdAt: new Date().toISOString(),
        questions: questions.map((q, i) => ({
            id: i + 1,
            type: q.type, // likert | pilihan_ganda | essay
            text: q.text,
            options: q.type === "pilihan_ganda" ? q.options || [] : undefined,
        })),
    };
    surveys.push(newSurvey);
    db.writeAll("surveys", surveys);
    res.status(201).json(newSurvey);
});

// GET /api/surveys - daftar survei aktif (semua role login boleh lihat)
router.get("/", verifyToken, (req, res) => {
    const surveys = db.readAll("surveys");
    const responses = db.readAll("responses");

    // Untuk Siswa/OrangTua: tandai mana yang sudah/belum diisi (dasar fitur notifikasi PB05)
    const list = surveys.map((s) => {
        const sudahIsi = responses.some((r) => r.surveyId === s.id && r.userId === req.user.id);
        return {
            id: s.id,
            judul: s.judul,
            deskripsi: s.deskripsi,
            status: s.status,
            createdByNama: s.createdByNama,
            createdAt: s.createdAt,
            jumlahPertanyaan: s.questions.length,
            sudahDiisi: sudahIsi,
        };
    });
    res.json(list);
});

// GET /api/surveys/:id - detail survei + pertanyaan (untuk pengisian)
router.get("/:id", verifyToken, (req, res) => {
    const survey = db.readAll("surveys").find((s) => s.id === Number(req.params.id));
    if (!survey) return res.status(404).json({ message: "Survei tidak ditemukan." });
    res.json(survey);
});

// POST /api/surveys/:id/responses - Siswa/OrangTua mengisi survei (PB02)
router.post("/:id/responses", verifyToken, requireRole("Siswa", "OrangTua"), (req, res) => {
    const surveyId = Number(req.params.id);
    const survey = db.readAll("surveys").find((s) => s.id === surveyId);
    if (!survey) return res.status(404).json({ message: "Survei tidak ditemukan." });

    const { answers } = req.body; // [{questionId, value}]
    if (!Array.isArray(answers) || answers.length !== survey.questions.length) {
        return res.status(400).json({ message: "Semua pertanyaan wajib dijawab." });
    }

    const responses = db.readAll("responses");
    const already = responses.some((r) => r.surveyId === surveyId && r.userId === req.user.id);
    if (already) {
        return res.status(409).json({ message: "Anda sudah mengisi survei ini sebelumnya." });
    }

    const newResponse = {
        id: db.nextId(responses),
        surveyId,
        userId: req.user.id,
        userNama: req.user.nama,
        userRole: req.user.role,
        answers,
        submittedAt: new Date().toISOString(),
    };
    responses.push(newResponse);
    db.writeAll("responses", responses);
    res.status(201).json({ message: "Terima kasih, jawaban survei berhasil dikirim." });
});

// GET /api/surveys/:id/results - agregasi hasil untuk dashboard (PB03, Admin & Guru)
router.get("/:id/results", verifyToken, requireRole("Admin", "Guru"), (req, res) => {
    const surveyId = Number(req.params.id);
    const survey = db.readAll("surveys").find((s) => s.id === surveyId);
    if (!survey) return res.status(404).json({ message: "Survei tidak ditemukan." });

    const responses = db.readAll("responses").filter((r) => r.surveyId === surveyId);

    const results = survey.questions.map((q) => {
        const jawaban = responses.map((r) => r.answers.find((a) => a.questionId === q.id)?.value);

        if (q.type === "likert") {
            const nums = jawaban.filter((v) => v !== undefined).map(Number);
            const rataRata = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            const distribusi = [1, 2, 3, 4, 5].map((skala) => nums.filter((n) => n === skala).length);
            return { questionId: q.id, text: q.text, type: q.type, rataRata: Number(rataRata.toFixed(2)), distribusi, totalJawaban: nums.length };
        }
        if (q.type === "pilihan_ganda") {
            const distribusi = (q.options || []).map((opt) => ({
                opsi: opt,
                jumlah: jawaban.filter((v) => v === opt).length,
            }));
            return { questionId: q.id, text: q.text, type: q.type, distribusi, totalJawaban: jawaban.filter(Boolean).length };
        }
        // essay
        return {
            questionId: q.id,
            text: q.text,
            type: q.type,
            jawabanEssay: jawaban.filter(Boolean),
            totalJawaban: jawaban.filter(Boolean).length,
        };
    });

    res.json({
        survey: { id: survey.id, judul: survey.judul, deskripsi: survey.deskripsi },
        totalResponden: responses.length,
        results,
    });
});

// GET /api/surveys/:id/export - unduh hasil sebagai CSV (dasar PB04, dibuka di Excel)
router.get("/:id/export", verifyToken, requireRole("Admin"), (req, res) => {
    const surveyId = Number(req.params.id);
    const survey = db.readAll("surveys").find((s) => s.id === surveyId);
    if (!survey) return res.status(404).json({ message: "Survei tidak ditemukan." });

    const responses = db.readAll("responses").filter((r) => r.surveyId === surveyId);

    const header = ["Nama Responden", "Peran", "Waktu Kirim", ...survey.questions.map((q) => q.text)];
    const rows = responses.map((r) => {
        const jawabanPerQ = survey.questions.map((q) => {
            const a = r.answers.find((a) => a.questionId === q.id);
            const val = a ? String(a.value).replace(/"/g, '""') : "";
            return `"${val}"`;
        });
        return [`"${r.userNama}"`, `"${r.userRole}"`, `"${r.submittedAt}"`, ...jawabanPerQ].join(",");
    });

    const csv = [header.map((h) => `"${h}"`).join(","), ...rows].join("\n");
    const filename = `hasil-survei-${survey.id}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM agar Excel membaca karakter dengan benar
});

module.exports = router;