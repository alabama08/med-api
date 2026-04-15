import Review from "../models/Review.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";

// @POST /api/reviews — Patient submits a review
export const submitReview = async (req, res) => {
  const { doctorId, appointmentId, rating, comment } = req.body;

  // Only allow review if appointment is completed
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found");
  }

  if (appointment.status !== "completed") {
    res.status(400);
    throw new Error("You can only review after a completed appointment");
  }

  if (appointment.patient.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to review this appointment");
  }

  // Check if already reviewed
  const existing = await Review.findOne({
    patient: req.user._id,
    appointment: appointmentId,
  });

  if (existing) {
    res.status(400);
    throw new Error("You have already reviewed this appointment");
  }

  const review = await Review.create({
    patient: req.user._id,
    doctor: doctorId,
    appointment: appointmentId,
    rating: Number(rating),
    comment: comment || "",
  });

  // Recalculate doctor average rating
  const allReviews = await Review.find({ doctor: doctorId });
  const avgRating =
    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

  await DoctorProfile.findOneAndUpdate(
    { user: doctorId },
    {
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
    }
  );

  // Notify doctor
  await Notification.create({
    user: doctorId,
    title: "New Review",
    message: `${req.user.name} left you a ${rating}-star review.`,
    type: "review",
    link: "/doctor/profile",
  });

  res.status(201).json({ success: true, message: "Review submitted", review });
};

// @GET /api/reviews/doctor/:doctorId — Get all reviews for a doctor
export const getDoctorReviews = async (req, res) => {
  const reviews = await Review.find({ doctor: req.params.doctorId })
    .populate("patient", "name avatar")
    .sort({ createdAt: -1 });

  res.json({ success: true, reviews });
};

// @DELETE /api/reviews/:id — Patient deletes own review
export const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  if (review.patient.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to delete this review");
  }

  await review.deleteOne();

  // Recalculate rating
  const allReviews = await Review.find({ doctor: review.doctor });
  const avgRating =
    allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

  await DoctorProfile.findOneAndUpdate(
    { user: review.doctor },
    {
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
    }
  );

  res.json({ success: true, message: "Review deleted" });
};