import EmailReply from "../models/EmailReply.js";
import JobApplication from "../models/JobApplication.js";
import { sendEmail } from "../services/emailService.js";

/* ─────────────────────────────────────────────────────────────────────────────
   IMPORTANT — HOW RESEND INBOUND WORKS:
   ──────────────────────────────────────
   When Resend receives an inbound email it fires a webhook to your endpoint.
   The webhook payload contains ONLY metadata (email_id, from, to, subject).
   It does NOT include the body text.

   To get the actual body you must call:
     GET https://api.resend.com/emails/:email_id
   using your Resend API key.

   This controller does exactly that.
───────────────────────────────────────────────────────────────────────────── */

/* ── Fetch full email content from Resend API ── */
const fetchEmailContent = async (emailId) => {
  const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error fetching email ${emailId}: ${err}`);
  }

  return res.json();
  /*
    Returns shape:
    {
      id, object, to, from, created_at, subject,
      html, text, headers, attachments, ...
    }
  */
};

/* ─────────────────────────────────────────────────────────────────────────────
   @POST /api/careers/webhook/inbound-email
   PUBLIC — called by Resend webhook (no auth middleware)

   Resend webhook payload for email.received event:
   {
     type: "email.received",
     created_at: "...",
     data: {
       email_id: "abc123",       <- use this to fetch full content
       from: "user@gmail.com",
       to: ["careers@reply.yourdomain.com"],
       subject: "Re: ...",
       created_at: "..."
     }
   }
───────────────────────────────────────────────────────────────────────────── */
export const handleInboundEmail = async (req, res) => {
  // Always respond 200 immediately so Resend does not retry
  res.status(200).json({ received: true });

  try {
    const payload = req.body;

    console.log("📬 Inbound webhook received:", JSON.stringify(payload, null, 2));

    const eventType = payload?.type;
    const data      = payload?.data ?? payload;

    // Only process email.received events
    if (eventType && eventType !== "email.received") {
      console.log(`ℹ️  Ignoring webhook event type: ${eventType}`);
      return;
    }

    const emailId   = data?.email_id ?? data?.id;
    const fromRaw   = Array.isArray(data?.from) ? data.from[0] : (data?.from ?? "");
    const fromEmail = fromRaw.toLowerCase().trim();
    const subject   = data?.subject ?? "(no subject)";

    if (!emailId) {
      console.error("❌ No email_id in webhook payload — cannot fetch body");
      return;
    }

    if (!fromEmail) {
      console.error("❌ No sender email in webhook payload");
      return;
    }

    // Prevent duplicate storage (Resend may retry the webhook)
    const exists = await EmailReply.findOne({ resendEmailId: emailId });
    if (exists) {
      console.log(`ℹ️  Email ${emailId} already stored — skipping duplicate`);
      return;
    }

    // Fetch the full email content (body text/html) from Resend API
    let fullEmail;
    try {
      fullEmail = await fetchEmailContent(emailId);
      console.log(`✅ Fetched full email body for ID: ${emailId}`);
    } catch (fetchErr) {
      console.error("❌ Failed to fetch email content from Resend:", fetchErr.message);
      return;
    }

    const bodyText = fullEmail?.text ?? "";
    const bodyHtml = fullEmail?.html ?? "";
    const fromName = fullEmail?.from_name ?? data?.from_name ?? fromEmail;

    // Find the most recent job application from this sender's email
    const application = await JobApplication.findOne({ email: fromEmail })
      .sort({ createdAt: -1 });

    if (!application) {
      console.warn(`⚠️  Inbound email from unknown applicant: ${fromEmail} — not stored`);
      return;
    }

    const reply = await EmailReply.create({
      resendEmailId:  emailId,
      applicationId:  application._id,
      applicantName:  fromName || application.fullName,
      applicantEmail: fromEmail,
      jobTitle:       application.jobTitle,
      subject,
      bodyText,
      bodyHtml,
      isRead:         false,
      rawPayload:     payload,
    });

    console.log(`📨 Reply stored — from: ${fromEmail} | job: "${application.jobTitle}" | reply _id: ${reply._id}`);

  } catch (err) {
    console.error("❌ handleInboundEmail processing error:", err.message);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   @GET /api/careers/admin/inbox
   Admin: paginated inbox
───────────────────────────────────────────────────────────────────────────── */
export const getInbox = async (req, res) => {
  const { page = 1, limit = 25, unreadOnly } = req.query;

  const query = {};
  if (unreadOnly === "true") query.isRead = false;

  const skip        = (Number(page) - 1) * Number(limit);
  const total       = await EmailReply.countDocuments(query);
  const unreadCount = await EmailReply.countDocuments({ isRead: false });

  const replies = await EmailReply.find(query)
    .populate("applicationId", "status fullName jobTitle email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.json({ success: true, replies, total, unreadCount, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @GET /api/careers/admin/inbox/:id
   Admin: single reply + auto-mark as read
───────────────────────────────────────────────────────────────────────────── */
export const getReplyById = async (req, res) => {
  const reply = await EmailReply.findById(req.params.id)
    .populate("applicationId", "status fullName jobTitle email phone city state yearsOfExperience");

  if (!reply) { res.status(404); throw new Error("Reply not found"); }

  if (!reply.isRead) { reply.isRead = true; await reply.save(); }

  res.json({ success: true, reply });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @GET /api/careers/admin/inbox/application/:applicationId
   Admin: all replies for a specific application (thread view)
───────────────────────────────────────────────────────────────────────────── */
export const getRepliesByApplication = async (req, res) => {
  const replies = await EmailReply.find({ applicationId: req.params.applicationId })
    .sort({ createdAt: 1 });

  await EmailReply.updateMany(
    { applicationId: req.params.applicationId, isRead: false },
    { $set: { isRead: true } }
  );

  res.json({ success: true, replies });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @POST /api/careers/admin/inbox/:id/reply
   Admin: send a reply email back to the applicant
───────────────────────────────────────────────────────────────────────────── */
export const sendAdminReply = async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) { res.status(400); throw new Error("Reply message cannot be empty"); }

  const originalReply = await EmailReply.findById(req.params.id)
    .populate("applicationId", "status fullName jobTitle email");

  if (!originalReply) { res.status(404); throw new Error("Reply not found"); }

  const { applicantEmail, applicantName, jobTitle, subject } = originalReply;
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  await sendEmail({
    to:      applicantEmail,
    subject: replySubject,
    text: `Hello ${applicantName},\n\n${message}\n\nBest regards,\nMedBook HR Team\ncareers@medbook.com\n\n---\nHave more questions? Simply reply to this email.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${replySubject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0A1628;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
              ⚕ Med<span style="color:#0E9B8A;">Book</span>
            </p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">HR Team Response</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0A1628;">Hello, ${applicantName} 👋</h1>
            <div style="background:#f4f7fa;border-radius:12px;padding:14px 18px;border-left:4px solid #0E9B8A;margin-bottom:24px;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#0E9B8A;text-transform:uppercase;letter-spacing:0.5px;">Regarding</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#0A1628;">${jobTitle}</p>
            </div>
            <div style="font-size:15px;color:#3D5170;line-height:1.75;white-space:pre-wrap;">${message}</div>
            <div style="margin-top:28px;background:#dbeafe;border-radius:10px;padding:14px 18px;border-left:3px solid #3b82f6;">
              <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                💬 <strong>Have more questions?</strong> Simply hit <strong>Reply</strong> and your message will reach our HR team directly.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f7fa;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#6B7C93;">© ${new Date().getFullYear()} MedBook Health Platform · Lagos, Nigeria</p>
            <p style="margin:6px 0 0;font-size:12px;color:#6B7C93;">
              <a href="mailto:careers@medbook.com" style="color:#0E9B8A;text-decoration:none;">careers@medbook.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  originalReply.isReplied = true;
  await originalReply.save();

  console.log(`✅ Admin reply sent to ${applicantEmail} — subject: "${replySubject}"`);
  res.json({ success: true, message: `Reply sent to ${applicantEmail}` });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @PATCH /api/careers/admin/inbox/:id/read
───────────────────────────────────────────────────────────────────────────── */
export const markAsRead = async (req, res) => {
  const reply = await EmailReply.findById(req.params.id);
  if (!reply) { res.status(404); throw new Error("Reply not found"); }
  reply.isRead = req.body.isRead !== undefined ? req.body.isRead : true;
  await reply.save();
  res.json({ success: true, isRead: reply.isRead });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @DELETE /api/careers/admin/inbox/:id
───────────────────────────────────────────────────────────────────────────── */
export const deleteReply = async (req, res) => {
  const reply = await EmailReply.findById(req.params.id);
  if (!reply) { res.status(404); throw new Error("Reply not found"); }
  await reply.deleteOne();
  res.json({ success: true, message: "Reply deleted" });
};

/* ─────────────────────────────────────────────────────────────────────────────
   @GET /api/careers/admin/inbox/stats
───────────────────────────────────────────────────────────────────────────── */
export const getInboxStats = async (req, res) => {
  const unreadCount = await EmailReply.countDocuments({ isRead: false });
  const totalCount  = await EmailReply.countDocuments();
  res.json({ success: true, unreadCount, totalCount });
};