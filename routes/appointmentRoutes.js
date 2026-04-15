import express from "express";
import {
  bookAppointment,
  getMyAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getAppointmentById,
} from "../controllers/appointmentController.js";
import { protect, doctorOnly } from "../middleware/authMiddleware.js";
import { approvedDoctorOnly } from "../middleware/doctorMiddleware.js";

const router = express.Router();

router.post("/", protect, bookAppointment);
router.get("/my", protect, getMyAppointments);
router.get("/doctor", protect, doctorOnly, getDoctorAppointments);
router.get("/:id", protect, getAppointmentById);
router.put("/:id/status", protect, doctorOnly, approvedDoctorOnly, updateAppointmentStatus);
router.put("/:id/cancel", protect, cancelAppointment);

export default router;