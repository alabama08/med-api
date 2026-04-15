import express from "express";
import {
  getStats,
  getAllDoctors,
  approveDoctor,
  rejectDoctor,
  getAllPatients,
  toggleUserActive,
  getAllAppointments,
  getAllPayments,
  deleteUser,
  deleteDoctorProfile,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from "../controllers/adminController.js";
import { updateAdminAvatar } from "../controllers/adminProfileController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { uploadAvatar } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/stats",                          getStats);
router.get("/doctors",                        getAllDoctors);
router.put("/doctors/:id/approve",            approveDoctor);
router.put("/doctors/:id/reject",             rejectDoctor);
router.delete("/doctor-profiles/:profileId",  deleteDoctorProfile);   // ← new
router.get("/patients",                       getAllPatients);
router.put("/users/:id/toggle",               toggleUserActive);
router.get("/appointments",                   getAllAppointments);
router.get("/payments",                       getAllPayments);
router.delete("/users/:id",                   deleteUser);
router.get("/profile",                        getAdminProfile);
router.put("/profile",                        updateAdminProfile);
router.put("/profile/change-password",        changeAdminPassword);

// Avatar upload
router.put("/avatar", (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) {
      const message =
        err.message ||
        err.error?.message ||
        err.http_code ||
        JSON.stringify(err);
      return next(new Error(`Upload failed: ${message}`));
    }
    next();
  });
}, updateAdminAvatar);

export default router;