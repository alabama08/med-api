import mongoose from "mongoose";

const availabilitySlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    required: true,
  },
  startTime: { type: String, required: true }, // e.g. "09:00"
  endTime: { type: String, required: true },   // e.g. "17:00"
  isAvailable: { type: Boolean, default: true },
});

const doctorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    specialty: {
      type: String,
      required: [true, "Specialty is required"],
      trim: true,
    },
    qualifications: [
      {
        degree: String,
        institution: String,
        year: Number,
      },
    ],
    licenseNumber: {
      type: String,
      required: [true, "Medical license number is required"],
      unique: true,
    },
    licenseDocument: {
      type: String, // Cloudinary URL
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    experience: {
      type: Number, // Years of experience
      default: 0,
    },
    consultationFee: {
      type: Number,
      required: [true, "Consultation fee is required"],
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    location: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "Nigeria" },
    },
    languages: [String],
    availability: [availabilitySlotSchema],
    isApproved: {
      type: Boolean,
      default: false,
    },
    isAvailableForChat: {
      type: Boolean,
      default: true,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    bankDetails: {
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      accountName: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const DoctorProfile = mongoose.model("DoctorProfile", doctorProfileSchema);
export default DoctorProfile;