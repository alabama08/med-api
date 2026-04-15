import express from "express";
import {
  getJobListings,
  getJobById,
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats,
} from "../controllers/careerController.js";
import {
  handleInboundEmail,
  getInbox,
  getReplyById,
  getRepliesByApplication,
  sendAdminReply,
  markAsRead,
  deleteReply,
  getInboxStats,
} from "../controllers/inboundEmailController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
════════════════════════════════════════════════════════════════ */
router.get("/",            getJobListings);
router.get("/:id",         getJobById);
router.post("/:id/apply",  submitApplication);

/* ════════════════════════════════════════════════════════════════
   WEBHOOK — called by Resend (NO auth — public, but path is secret)
   Configure in Resend Dashboard → Domains → Inbound → Webhook URL:
     https://yourdomain.com/api/careers/webhook/inbound-email
════════════════════════════════════════════════════════════════ */
router.post("/webhook/inbound-email", handleInboundEmail);

/* ════════════════════════════════════════════════════════════════
   ADMIN ROUTES — all require protect + adminOnly
════════════════════════════════════════════════════════════════ */
router.use(protect, adminOnly);

// ── Job application management ──────────────────────────────────
router.get("/admin/stats",              getApplicationStats);
router.get("/admin/applications",       getAllApplications);
router.get("/admin/applications/:id",   getApplicationById);
router.put("/admin/applications/:id",   updateApplicationStatus);
router.delete("/admin/applications/:id", deleteApplication);

// ── Career inbox (inbound applicant replies) ────────────────────
router.get("/admin/inbox",                              getInbox);
router.get("/admin/inbox/stats",                        getInboxStats);
router.get("/admin/inbox/application/:applicationId",   getRepliesByApplication);
router.get("/admin/inbox/:id",                          getReplyById);
router.post("/admin/inbox/:id/reply",                   sendAdminReply);
router.patch("/admin/inbox/:id/read",                   markAsRead);
router.delete("/admin/inbox/:id",                       deleteReply);

export default router;