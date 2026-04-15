import express from "express";
import {
  initializePayment,
  verifyPayment,
  getMyPayments,
  getDoctorEarnings,
} from "../controllers/paymentController.js";
import { protect, doctorOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initialize", protect, initializePayment);
router.get("/verify/:reference", protect, verifyPayment);
router.get("/my", protect, getMyPayments);
router.get("/earnings", protect, doctorOnly, getDoctorEarnings);

export default router;