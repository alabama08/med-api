import express from "express";
import {
  submitReview,
  getDoctorReviews,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, submitReview);
router.get("/doctor/:doctorId", getDoctorReviews);
router.delete("/:id", protect, deleteReview);

export default router;