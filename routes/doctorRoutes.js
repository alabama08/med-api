import express from "express";
import {
  getAllDoctors,
  getDoctorById,
  updateDoctorProfile,
  uploadAvatar,
  getDoctorAvailability,
  updateAvailability,
  getMyDoctorProfile,
} from "../controllers/doctorController.js";
import { protect, doctorOnly } from "../middleware/authMiddleware.js";
import { approvedDoctorOnly } from "../middleware/doctorMiddleware.js";
import { uploadAvatar as uploadAvatarMiddleware } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ── Public ──
router.get("/", getAllDoctors);

// ── Named protected routes BEFORE /:id ──
router.get("/me",         protect, doctorOnly, getMyDoctorProfile);
router.get("/my-profile", protect, doctorOnly, getMyDoctorProfile);

router.put("/profile",      protect, doctorOnly, updateDoctorProfile);
router.put("/availability", protect, doctorOnly, approvedDoctorOnly, updateAvailability);

// ── Avatar upload — multer error handled inline ──
router.put(
  "/avatar",
  protect,
  (req, res, next) => {
    uploadAvatarMiddleware.single("avatar")(req, res, (err) => {
      if (err) {
        res.status(400);
        return next(new Error(err.message || "File upload failed. Please try again."));
      }
      next();
    });
  },
  uploadAvatar
);

// ── Param routes LAST ──
router.get("/:id",              getDoctorById);
router.get("/:id/availability", getDoctorAvailability);

export default router;