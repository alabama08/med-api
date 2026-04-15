import express from "express";
import {
  writePrescription,
  getMyPrescriptions,
  getDoctorPrescriptions,
  getPrescriptionById,
  updatePrescription,
} from "../controllers/prescriptionController.js";
import { protect, doctorOnly } from "../middleware/authMiddleware.js";
import { approvedDoctorOnly } from "../middleware/doctorMiddleware.js";

const router = express.Router();

router.post("/", protect, doctorOnly, approvedDoctorOnly, writePrescription);
router.get("/my", protect, getMyPrescriptions);
router.get("/doctor", protect, doctorOnly, getDoctorPrescriptions);
router.get("/:id", protect, getPrescriptionById);
router.put("/:id", protect, doctorOnly, updatePrescription);

export default router;