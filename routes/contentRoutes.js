import express from "express";
import {
  getPublicContent,
  getGroupedPublicContent,
  getAllContent,
  createContent,
  updateContent,
  deleteContent,
  togglePublish,
  togglePin,
  getContentStats,
} from "../controllers/contentController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Public ──
router.get("/public",         getPublicContent);
router.get("/public/grouped", getGroupedPublicContent);

// ── Admin ──
router.use(protect, adminOnly);
router.get("/",               getAllContent);
router.get("/stats",          getContentStats);
router.post("/",              createContent);
router.put("/:id",            updateContent);
router.delete("/:id",         deleteContent);
router.put("/:id/toggle",     togglePublish);
router.put("/:id/pin",        togglePin);

export default router;