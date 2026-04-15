// routes/uploadRoute.js
import express                from "express";
import multer                 from "multer";
import { CloudinaryStorage }  from "multer-storage-cloudinary";
import cloudinary             from "../config/cloudinary.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────
   CLOUDINARY STORAGE — images & videos
   Folder: medbook/media
───────────────────────────────────────────────────── */
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder:          "medbook/media",
      resource_type:   isVideo ? "video" : "image",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mov"],
      // Optional: auto-compress images, no resize on videos
      transformation:  isVideo ? [] : [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

/* ─────────────────────────────────────────────────────
   CLOUDINARY STORAGE — documents (resumes)
   Folder: medbook/resumes  |  resource_type: raw
───────────────────────────────────────────────────── */
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:        "medbook/resumes",
    resource_type: "raw",   // ← required for PDF/DOC/DOCX
    allowed_formats: ["pdf", "doc", "docx"],
  },
});

/* ── File filters (still validate on server side) ── */
const mediaFilter = (req, file, cb) => {
  const allowed = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime))$/;
  allowed.test(file.mimetype)
    ? cb(null, true)
    : cb(new Error(`Unsupported type: ${file.mimetype}`), false);
};

const documentFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error(`Only PDF, DOC, DOCX accepted. Got: ${file.mimetype}`), false);
};

/* ── Multer instances ── */
const uploadMedia = multer({
  storage:    mediaStorage,
  fileFilter: mediaFilter,
  limits:     { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const uploadDocument = multer({
  storage:    documentStorage,
  fileFilter: documentFilter,
  limits:     { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/* ─────────────────────────────────────────────────────
   POST /api/upload
   Admin-only — images & videos for the content manager
   Returns: { success, url, public_id }
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
    console.log("✅ Media uploaded to Cloudinary:", req.file.path);
    res.status(201).json({
      success:   true,
      url:       req.file.path,       // ← full Cloudinary HTTPS URL
      public_id: req.file.filename,   // ← use this if you need to delete later
    });
  }
);

/* ─────────────────────────────────────────────────────
   POST /api/upload/resume
   Public — PDF / DOC / DOCX for job applications
   Returns: { success, url, public_id }
───────────────────────────────────────────────────── */
router.post(
  "/resume",
  uploadDocument.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file received" });
    }
    console.log("✅ Resume uploaded to Cloudinary:", req.file.path);
    res.status(201).json({
      success:   true,
      url:       req.file.path,
      public_id: req.file.filename,
    });
  }
);

/* ── Multer error handler ── */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith("Unsupported") || err.message?.startsWith("Only")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default router;