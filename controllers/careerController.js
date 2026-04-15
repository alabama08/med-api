import JobApplication from "../models/JobApplication.js";
import HospitalContent from "../models/HospitalContent.js";
import Notification from "../models/Notification.js";
import {
  sendJobApplicationEmail,
  sendApplicationStatusEmail,
} from "../services/emailService.js";

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/careers — Public: get all published job listings
// ─────────────────────────────────────────────────────────────────────────────
export const getJobListings = async (req, res) => {
  const { department, jobType, search } = req.query;

  const query = { type: "job", isPublished: true };

  if (department) query["meta.category"] = { $regex: department, $options: "i" };
  if (jobType)    query["meta.jobType"]  = jobType;
  if (search)     query.title            = { $regex: search, $options: "i" };

  const jobs = await HospitalContent.find(query)
    .sort({ isPinned: -1, order: 1, createdAt: -1 });

  res.json({ success: true, jobs, total: jobs.length });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/careers/:id — Public: get single job detail
// ─────────────────────────────────────────────────────────────────────────────
export const getJobById = async (req, res) => {
  const job = await HospitalContent.findOne({
    _id: req.params.id,
    type: "job",
    isPublished: true,
  });

  if (!job) {
    res.status(404);
    throw new Error("Job listing not found");
  }

  res.json({ success: true, job });
};

// ─────────────────────────────────────────────────────────────────────────────
// @POST /api/careers/:id/apply — Public: submit application
// ─────────────────────────────────────────────────────────────────────────────
export const submitApplication = async (req, res) => {
  const job = await HospitalContent.findOne({
    _id: req.params.id,
    type: "job",
    isPublished: true,
  });

  if (!job) {
    res.status(404);
    throw new Error("Job listing not found or no longer accepting applications");
  }

  const {
    fullName, email, phone, city, state,
    yearsOfExperience, currentEmployer, highestEducation,
    licenseNumber, coverLetter, resumeUrl,
    linkedIn, portfolio, referralSource,
  } = req.body;

  // Check for duplicate application
  const existing = await JobApplication.findOne({
    email: email.toLowerCase(),
    jobId: job._id,
  });

  if (existing) {
    res.status(400);
    throw new Error(
      "You have already submitted an application for this position. We will be in touch soon."
    );
  }

  const application = await JobApplication.create({
    jobId:             job._id,
    jobTitle:          job.title,
    fullName,
    email,
    phone,
    city,
    state,
    yearsOfExperience,
    currentEmployer:   currentEmployer || "",
    highestEducation,
    licenseNumber:     licenseNumber   || "",
    coverLetter,
    resumeUrl,
    linkedIn:          linkedIn        || "",
    portfolio:         portfolio       || "",
    referralSource:    referralSource  || "MedBook Website",
    status:            "pending",
  });

  // Send confirmation email to applicant (non-blocking)
  try {
    await sendJobApplicationEmail(email, fullName, job.title);
  } catch (err) {
    console.error("Job application email failed (non-critical):", err.message);
  }

  res.status(201).json({
    success: true,
    message:
      "Your application has been received. We will review it and contact you within 5–7 business days.",
    applicationId: application._id,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/careers/admin/applications — Admin: get all applications
// ─────────────────────────────────────────────────────────────────────────────
export const getAllApplications = async (req, res) => {
  const { status, jobId, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (jobId)  query.jobId  = jobId;
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email:    { $regex: search, $options: "i" } },
      { jobTitle: { $regex: search, $options: "i" } },
    ];
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await JobApplication.countDocuments(query);

  const applications = await JobApplication.find(query)
    .populate("reviewedBy", "name avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    applications,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/careers/admin/applications/:id — Admin: get single application
// ─────────────────────────────────────────────────────────────────────────────
export const getApplicationById = async (req, res) => {
  const application = await JobApplication.findById(req.params.id)
    .populate("reviewedBy", "name avatar");

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  res.json({ success: true, application });
};

// ─────────────────────────────────────────────────────────────────────────────
// @PUT /api/careers/admin/applications/:id — Admin: update status / notes
// Automatically emails the applicant when their status changes.
// ─────────────────────────────────────────────────────────────────────────────
export const updateApplicationStatus = async (req, res) => {
  const { status, adminNotes, interviewDate } = req.body;

  const application = await JobApplication.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  const previousStatus = application.status;

  if (status)                       application.status        = status;
  if (adminNotes !== undefined)     application.adminNotes    = adminNotes;
  if (interviewDate)                application.interviewDate = new Date(interviewDate);

  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();

  await application.save();

  /* ── Email the applicant if their status actually changed ── */
  const statusChanged = status && status !== previousStatus;

  if (statusChanged) {
    try {
      await sendApplicationStatusEmail(
        application.email,
        application.fullName,
        application.jobTitle,
        status,
        interviewDate || application.interviewDate || null,
      );
      console.log(
        `✅ Status email sent to ${application.email} — status: ${previousStatus} → ${status}`
      );
    } catch (err) {
      /* Non-blocking — the status update still succeeds even if email fails */
      console.error("❌ Status update email failed (non-critical):", err.message);
    }
  }

  res.json({
    success: true,
    message: `Application updated${statusChanged ? ` — applicant notified at ${application.email}` : ""}`,
    application,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @DELETE /api/careers/admin/applications/:id — Admin: delete application
// ─────────────────────────────────────────────────────────────────────────────
export const deleteApplication = async (req, res) => {
  const application = await JobApplication.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  await application.deleteOne();
  res.json({ success: true, message: "Application deleted" });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/careers/admin/stats — Admin: application stats dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getApplicationStats = async (req, res) => {
  const total       = await JobApplication.countDocuments();
  const pending     = await JobApplication.countDocuments({ status: "pending" });
  const shortlisted = await JobApplication.countDocuments({ status: "shortlisted" });
  const hired       = await JobApplication.countDocuments({ status: "hired" });
  const rejected    = await JobApplication.countDocuments({ status: "rejected" });

  const byJob = await JobApplication.aggregate([
    { $group: { _id: "$jobTitle", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const recentApplications = await JobApplication.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("fullName jobTitle status createdAt");

  res.json({
    success: true,
    stats: { total, pending, shortlisted, hired, rejected },
    byJob,
    recentApplications,
  });
};