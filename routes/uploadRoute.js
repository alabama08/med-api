// routes/uploadRoute.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ── Absolute path to uploads folder ── */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const uploadDir  = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Created uploads directory:", uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");
    cb(null, `${Date.now()}-${basename}${ext}`);
  },
});

/* ─────────────────────────────────────────────────────
   FILE FILTER — MEDIA ONLY (images + videos)
   Used by: admin content manager uploads
───────────────────────────────────────────────────── */
const mediaFilter = (req, file, cb) => {
  const allowedExts  = /\.(jpeg|jpg|png|gif|webp|mp4|webm|mov)$/i;
  const allowedMimes = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|quicktime))$/;

  if (allowedExts.test(file.originalname) && allowedMimes.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

/* ─────────────────────────────────────────────────────
   FILE FILTER — DOCUMENTS (PDF, DOC, DOCX)
   Used by: public resume / CV uploads from CareersPage
───────────────────────────────────────────────────── */
const documentFilter = (req, file, cb) => {
  const allowedExts  = /\.(pdf|doc|docx)$/i;
  const allowedMimes = [
    "application/pdf",
    "application/msword",                                                          // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",    // .docx
  ];

  const extOk  = allowedExts.test(file.originalname);
  const mimeOk = allowedMimes.includes(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Only PDF, DOC, and DOCX are accepted.`), false);
  }
};

/* ── Multer instances ── */
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — videos can be large
});

const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB — resumes should be small
});

/* ─────────────────────────────────────────────────────
   POST /api/upload
   Admin-only — images & videos for the content manager
───────────────────────────────────────────────────── */
router.post(
  "/",
  protect,
  adminOnly,
  uploadMedia.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file received" });
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    console.log("✅ Media uploaded:", req.file.filename, "→", url);
    res.status(201).json({ success: true, url });
  }
);

/* ─────────────────────────────────────────────────────
   POST /api/upload/resume
   Public (no auth) — PDF / DOC / DOCX for job applications
───────────────────────────────────────────────────── */
router.post(
  "/resume",
  uploadDocument.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file received" });
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    console.log("✅ Resume uploaded:", req.file.filename, "→", url);
    res.status(201).json({ success: true, url });
  }
);

export default router;