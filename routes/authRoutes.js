import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateProfile,
  updateUserAvatar,
  changePassword,
  searchUsers,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadAvatar } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ── Public ──
router.post("/register",            register);
router.post("/login",               login);
router.post("/logout",              logout);
router.get( "/verify-email/:token", verifyEmail);
router.post("/forgot-password",     forgotPassword);
router.put( "/reset-password/:token", resetPassword);

// ── Protected ──
router.get("/me",              protect, getMe);
router.put("/update-profile",  protect, updateProfile);
router.put("/change-password", protect, changePassword);

// NEW — search users by role
// GET /api/users/search?role=doctor&q=john
router.get("/search", protect, searchUsers);

// ── Avatar upload — multer error handled inline ──
router.put(
  "/avatar",
  protect,
  (req, res, next) => {
    uploadAvatar.single("avatar")(req, res, (err) => {
      if (err) {
        // Multer or Cloudinary error
        res.status(400);
        return next(new Error(err.message || "File upload failed. Please try again."));
      }
      next();
    });
  },
  updateUserAvatar
);

export default router;