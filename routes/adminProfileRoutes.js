import express from "express";
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminAvatar,
} from "../controllers/adminProfileController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { uploadAvatar } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/",                getAdminProfile);
router.put("/",                updateAdminProfile);
router.put("/change-password", changeAdminPassword);

// Wrap multer so Cloudinary errors reach your errorHandler
router.put("/avatar", (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) return next(err); // passes to errorHandler with real message
    next();
  });
}, updateAdminAvatar);

export default router;