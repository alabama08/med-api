import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    // Which job posting they applied to (from HospitalContent)
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HospitalContent",
      required: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },

    // Applicant personal info
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },

    // Professional details
    yearsOfExperience: {
      type: Number,
      required: [true, "Years of experience is required"],
      min: 0,
    },
    currentEmployer: {
      type: String,
      default: "",
      trim: true,
    },
    highestEducation: {
      type: String,
      enum: [
        "High School Diploma",
        "Associate Degree",
        "Bachelor's Degree",
        "Master's Degree",
        "Doctoral Degree (PhD)",
        "Medical Degree (MD/DO)",
        "Nursing Degree (RN/BSN)",
        "Other",
      ],
      required: [true, "Education level is required"],
    },
    licenseNumber: {
      type: String,
      default: "",
      trim: true,
    },

    // Application content
    coverLetter: {
      type: String,
      required: [true, "Cover letter is required"],
      minlength: [100, "Cover letter must be at least 100 characters"],
    },
    resumeUrl: {
      type: String,
      required: [true, "Resume/CV is required"],
    },

    // LinkedIn / Portfolio (optional)
    linkedIn: {
      type: String,
      default: "",
      trim: true,
    },
    portfolio: {
      type: String,
      default: "",
      trim: true,
    },

    // How they heard about the role
    referralSource: {
      type: String,
      enum: [
        "MedBook Website",
        "LinkedIn",
        "Indeed",
        "Employee Referral",
        "Job Fair",
        "Other",
      ],
      default: "MedBook Website",
    },

    // Admin workflow
    status: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "shortlisted",
        "interview_scheduled",
        "offer_extended",
        "hired",
        "rejected",
        "withdrawn",
      ],
      default: "pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    interviewDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for fast queries
jobApplicationSchema.index({ status: 1, createdAt: -1 });
jobApplicationSchema.index({ email: 1, jobId: 1 }, { unique: true }); // one application per job per email

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
export default JobApplication;