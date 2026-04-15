import mongoose from "mongoose";

const hospitalContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "hero",
        "announcement",
        "service",
        "department",
        "doctor_spotlight",
        "testimonial",
        "news",
        "health_tip",
        "facility",
        "insurance",
        "emergency",
        "gallery",
        "event",
        "award",
        "video",
        "stat",
        "job",
        "faq",
        "partner",
        "promotion",
      ],
      required: true,
    },
    title:    { type: String, required: true, trim: true },
    subtitle: { type: String, default: "" },
    body:     { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    images:   [{ type: String }], // for gallery — multiple images
    videoUrl: { type: String, default: "" },
    icon:     { type: String, default: "" },
    ctaText:  { type: String, default: "" },
    ctaLink:  { type: String, default: "" },
    tags:     [String],
    isPublished: { type: Boolean, default: true },
    isPinned:    { type: Boolean, default: false },
    order:       { type: Number, default: 0 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
    },
    meta: {
      color:    { type: String, default: "" },
      badge:    { type: String, default: "" },
      category: { type: String, default: "" },
      date:     { type: String, default: "" },  // for events
      time:     { type: String, default: "" },  // for events
      location: { type: String, default: "" },  // for events/facilities
      value:    { type: String, default: "" },  // for stats
      unit:     { type: String, default: "" },  // for stats (years, patients, etc.)
      answer:   { type: String, default: "" },  // for FAQ body answer
      link:     { type: String, default: "" },  // for partners
      salary:   { type: String, default: "" },  // for jobs
      jobType:  { type: String, default: "" },  // Full-time, Part-time
    },
  },
  { timestamps: true }
);

const HospitalContent = mongoose.model("HospitalContent", hospitalContentSchema);
export default HospitalContent;