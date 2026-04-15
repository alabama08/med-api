import mongoose from "mongoose";

const emailReplySchema = new mongoose.Schema(
  {
    // Resend's email ID — used to prevent duplicate storage on webhook retry
    resendEmailId: {
      type: String,
      unique: true,
      sparse: true,   // allows null/undefined for manually created test entries
      trim: true,
    },

    // The job application this reply belongs to
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobApplication",
      required: true,
    },

    // Denormalised for fast display
    applicantName:  { type: String, required: true, trim: true },
    applicantEmail: { type: String, required: true, lowercase: true, trim: true },
    jobTitle:       { type: String, required: true, trim: true },

    // Email content (fetched from Resend API after webhook fires)
    subject:  { type: String, default: "(no subject)", trim: true },
    bodyText: { type: String, default: "" },
    bodyHtml: { type: String, default: "" },

    // Admin workflow
    isRead:    { type: Boolean, default: false },
    isReplied: { type: Boolean, default: false },

    // Raw Resend webhook payload — kept for debugging
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

emailReplySchema.index({ applicationId: 1, createdAt: -1 });
emailReplySchema.index({ isRead: 1, createdAt: -1 });
emailReplySchema.index({ applicantEmail: 1 });

const EmailReply = mongoose.model("EmailReply", emailReplySchema);
export default EmailReply;