import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter config error:", error.message);
  } else {
    console.log("✅ Email transporter ready — Resend SMTP connected");
  }
});

/**
 * INBOUND_REPLY_TO
 * ─────────────────
 * This is the address Resend gives you for inbound email routing.
 * Format:  <anything>@<your-resend-inbound-domain>
 *
 * Steps to configure in Resend Dashboard:
 *  1. Go to Resend → Domains → Add Domain (or use existing)
 *  2. Enable "Inbound" for that domain
 *  3. Set Webhook URL to: https://yourdomain.com/api/careers/webhook/inbound-email
 *  4. Set this env var to e.g. "careers-reply@mail.yourresend.domain"
 *
 * When a job seeker hits "Reply" in their email client, their message goes
 * to this address, Resend receives it and POSTs to your webhook.
 */
const INBOUND_REPLY_TO =
  process.env.CAREERS_REPLY_TO_EMAIL || "careers@reply.yourdomain.com";

/* ─────────────────────────────────────────────────────────────────────────────
   Core sendEmail wrapper
───────────────────────────────────────────────────────────────────────────── */
export const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  try {
    const from    = process.env.EMAIL_FROM || '"MedBook Health" <noreply@zarichristy.cfd>';
    const mailOpts = { from, to, subject, text: text || subject, html };

    // Allow per-call override; defaults to the global from address
    if (replyTo) mailOpts.replyTo = replyTo;

    const info = await transporter.sendMail(mailOpts);
    console.log(`✅ Email sent to ${to} — ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("❌ Email send error:", error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Verification email
───────────────────────────────────────────────────────────────────────────── */
export const sendVerificationEmail = async (to, token, name) => {
  const url = `${process.env.CLIENT_URL}/verify-email/${token}`;

  await sendEmail({
    to,
    subject: "Confirm your MedBook account",
    text: `Hello ${name},\n\nPlease confirm your MedBook account by visiting this link:\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not create a MedBook account, please ignore this email.\n\nMedBook Team`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirm your MedBook account</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0A1628;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ⚕ Med<span style="color:#0E9B8A;">Book</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Healthcare made simple</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0A1628;">
                Hello, ${name || "there"} 👋
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6B7C93;line-height:1.7;">
                Thank you for creating a MedBook account. Please confirm your email address to activate your account and get started.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#0E9B8A;border-radius:10px;">
                    <a href="${url}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      Confirm Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#6B7C93;">Or copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#0E9B8A;word-break:break-all;">${url}</p>
              <div style="background:#f4f7fa;border-radius:10px;padding:14px 18px;border-left:3px solid #0E9B8A;">
                <p style="margin:0;font-size:13px;color:#6B7C93;line-height:1.6;">
                  ⏰ This link expires in <strong style="color:#0A1628;">24 hours</strong>.<br/>
                  If you did not create this account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f7fa;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#6B7C93;">
                © ${new Date().getFullYear()} MedBook Health Platform · Lagos, Nigeria
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#6B7C93;">
                Questions? Email us at <a href="mailto:support@medbook.com" style="color:#0E9B8A;text-decoration:none;">support@medbook.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Password reset email
───────────────────────────────────────────────────────────────────────────── */
export const sendPasswordResetEmail = async (to, token, name) => {
  const url = `${process.env.CLIENT_URL}/reset-password/${token}`;

  await sendEmail({
    to,
    subject: "Reset your MedBook password",
    text: `Hello ${name || "there"},\n\nYou requested a password reset for your MedBook account.\n\nVisit this link to reset your password:\n${url}\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nMedBook Team`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your MedBook password</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0A1628;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">
                ⚕ Med<span style="color:#0E9B8A;">Book</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Healthcare made simple</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0A1628;">Password Reset Request</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6B7C93;line-height:1.7;">
                Hello ${name || "there"}, we received a request to reset your MedBook password. Click below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                <tr>
                  <td style="background:#0E9B8A;border-radius:10px;">
                    <a href="${url}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#6B7C93;">Or copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#0E9B8A;word-break:break-all;">${url}</p>
              <div style="background:#fef3c7;border-radius:10px;padding:14px 18px;border-left:3px solid #f59e0b;">
                <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                  ⏰ This link expires in <strong>1 hour</strong>.<br/>
                  If you did not request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f7fa;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#6B7C93;">
                © ${new Date().getFullYear()} MedBook Health Platform · Lagos, Nigeria
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Job Application Confirmation Email
   ── Reply-To set to INBOUND_REPLY_TO so applicant replies route back ──
───────────────────────────────────────────────────────────────────────────── */
export const sendJobApplicationEmail = async (to, name, jobTitle) => {
  await sendEmail({
    to,
    replyTo: INBOUND_REPLY_TO,
    subject: `Application Received — ${jobTitle}`,
    text: `Hello ${name},\n\nThank you for applying for the ${jobTitle} position at MedBook.\n\nWe have received your application and our team will review it shortly. You can expect to hear from us within 5–7 business days.\n\nFeel free to reply to this email if you have any questions.\n\nBest regards,\nMedBook Recruitment Team`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Application Received</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0A1628;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ⚕ Med<span style="color:#0E9B8A;">Book</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Healthcare made simple</p>
            </td>
          </tr>
          <tr>
            <td style="background:#0E9B8A;padding:18px 40px;text-align:center;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">✅ Application Successfully Received</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0A1628;">Hello, ${name} 👋</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6B7C93;line-height:1.7;">
                Thank you for applying for the position below. We're excited to learn more about you!
              </p>
              <div style="background:#f4f7fa;border-radius:12px;padding:20px 24px;border-left:4px solid #0E9B8A;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#0E9B8A;text-transform:uppercase;letter-spacing:0.5px;">Position Applied For</p>
                <p style="margin:0;font-size:18px;font-weight:800;color:#0A1628;">${jobTitle}</p>
                <p style="margin:6px 0 0;font-size:13px;color:#6B7C93;">MedBook Health Platform</p>
              </div>
              <div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;border-left:3px solid #22c55e;margin-bottom:16px;">
                <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
                  💡 <strong>Tip:</strong> Keep an eye on your inbox (and spam folder) for updates on your application status.
                </p>
              </div>
              <div style="background:#dbeafe;border-radius:10px;padding:14px 18px;border-left:3px solid #3b82f6;">
                <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                  💬 <strong>Have a question?</strong> Simply reply to this email and our HR team will get back to you directly.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f7fa;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#6B7C93;">
                © ${new Date().getFullYear()} MedBook Health Platform · Lagos, Nigeria
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#6B7C93;">
                Questions? <a href="mailto:careers@medbook.com" style="color:#0E9B8A;text-decoration:none;">careers@medbook.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Application Status Update Email
   ── Reply-To set to INBOUND_REPLY_TO on every status email ──
   Sends a personalised email to the job seeker for every status change.
───────────────────────────────────────────────────────────────────────────── */
export const sendApplicationStatusEmail = async (to, name, jobTitle, status, interviewDate = null) => {

  const STATUS_MAP = {
    under_review: {
      subject:     `Update on Your Application — ${jobTitle}`,
      bannerColor: "#3B82F6",
      bannerText:  "🔍 Your Application Is Under Review",
      headline:    `Your Application Is Being Reviewed`,
      body:        `Good news — your application for <strong>${jobTitle}</strong> has moved to the review stage. Our hiring team is carefully evaluating your qualifications and experience. You do not need to do anything right now.`,
      next:        "We will be in touch within 3–5 business days with a further update.",
      tipColor:    "#DBEAFE",
      tipBorder:   "#3B82F6",
      tipText:     "#1E40AF",
      tip:         "Our team reviews every application thoroughly. Thank you for your patience.",
    },
    shortlisted: {
      subject:     `🎉 You've Been Shortlisted — ${jobTitle}`,
      bannerColor: "#10B981",
      bannerText:  "⭐ Congratulations — You Have Been Shortlisted!",
      headline:    "Great News — You Made the Shortlist!",
      body:        `We are pleased to inform you that you have been shortlisted for the <strong>${jobTitle}</strong> position at MedBook. Your experience and qualifications stood out among a competitive pool of applicants — well done!`,
      next:        "A member of our HR team will contact you shortly to schedule a phone screening call. Please keep your phone available.",
      tipColor:    "#D1FAE5",
      tipBorder:   "#10B981",
      tipText:     "#065F46",
      tip:         "Make sure your phone is available — we may call you within the next 1–3 business days.",
    },
    interview_scheduled: {
      subject:     `📅 Interview Scheduled — ${jobTitle}`,
      bannerColor: "#8B5CF6",
      bannerText:  "📅 Your Interview Has Been Scheduled",
      headline:    "You Have an Interview!",
      body:        `We are excited to invite you to an interview for the <strong>${jobTitle}</strong> position at MedBook.${
        interviewDate
          ? ` Your interview is confirmed for <strong>${new Date(interviewDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>.`
          : " Our HR team will contact you shortly to confirm the exact date, time, and format."
      }`,
      next:        "Please reply to this email to confirm your attendance, or reach out if you need to reschedule.",
      tipColor:    "#EDE9FE",
      tipBorder:   "#8B5CF6",
      tipText:     "#4C1D95",
      tip:         "Prepare by reviewing the job description and researching MedBook's mission and services.",
    },
    offer_extended: {
      subject:     `🎁 Job Offer Extended — ${jobTitle} at MedBook`,
      bannerColor: "#059669",
      bannerText:  "🎁 We Would Like to Make You an Offer!",
      headline:    "An Offer Is on Its Way!",
      body:        `We are thrilled to inform you that MedBook would like to extend a formal job offer for the <strong>${jobTitle}</strong> position. We were truly impressed by your background, experience, and enthusiasm throughout the hiring process.`,
      next:        "Our HR team will contact you within 1–2 business days with the full offer letter, compensation details, and onboarding next steps.",
      tipColor:    "#ECFDF5",
      tipBorder:   "#059669",
      tipText:     "#064E3B",
      tip:         "Take your time reviewing the offer. Feel free to reply to this email with any questions.",
    },
    hired: {
      subject:     `🎉 Welcome to MedBook — ${jobTitle}`,
      bannerColor: "#065F46",
      bannerText:  "🎉 Welcome to the MedBook Family!",
      headline:    "You Are Officially Part of the Team!",
      body:        `We are absolutely delighted to welcome you to MedBook as our new <strong>${jobTitle}</strong>. This is the beginning of an exciting journey and we cannot wait to have you on board. Your dedication and talent are exactly what our team needs.`,
      next:        "Our onboarding coordinator will contact you within 48 hours with your official start date, required documents, and everything you need for a great first day.",
      tipColor:    "#D1FAE5",
      tipBorder:   "#10B981",
      tipText:     "#065F46",
      tip:         "Get ready — we have big things planned and we are so glad you are joining us!",
    },
    rejected: {
      subject:     `Your Application Update — ${jobTitle}`,
      bannerColor: "#6B7280",
      bannerText:  "📋 An Update on Your Application",
      headline:    "Thank You for Applying",
      body:        `Thank you sincerely for taking the time to apply for the <strong>${jobTitle}</strong> position at MedBook and for your genuine interest in joining our team. After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current requirements.`,
      next:        "This decision does not reflect on your overall abilities or potential. We encourage you to apply for future openings at MedBook that match your experience.",
      tipColor:    "#F3F4F6",
      tipBorder:   "#D1D5DB",
      tipText:     "#374151",
      tip:         "We keep applications on file for 6 months. A suitable role may open up — we will be in touch.",
    },
    withdrawn: {
      subject:     `Application Withdrawn — ${jobTitle}`,
      bannerColor: "#6B7280",
      bannerText:  "📋 Application Withdrawal Confirmed",
      headline:    "Your Application Has Been Withdrawn",
      body:        `This email confirms that your application for the <strong>${jobTitle}</strong> position at MedBook has been withdrawn as requested. We respect your decision and wish you all the best in your job search.`,
      next:        "If this was done in error, or if you would like to reapply in the future, please do not hesitate to contact our careers team.",
      tipColor:    "#F3F4F6",
      tipBorder:   "#D1D5DB",
      tipText:     "#374151",
      tip:         "You are always welcome to apply for future openings at MedBook.",
    },
  };

  const content = STATUS_MAP[status];

  if (!content) {
    console.log(`ℹ️  No status email configured for status: ${status} — skipping`);
    return;
  }

  const plainText = `Hello ${name},\n\n${content.headline}\n\n${content.body.replace(/<[^>]+>/g, "")}\n\nWhat happens next:\n${content.next}\n\nHave a question? Simply reply to this email and our HR team will respond directly.\n\nBest regards,\nMedBook Recruitment Team\ncareers@medbook.com`;

  await sendEmail({
    to,
    replyTo: INBOUND_REPLY_TO,   // ← KEY LINE: replies route back to Resend inbound
    subject: content.subject,
    text:    plainText,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:#0A1628;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ⚕ Med<span style="color:#0E9B8A;">Book</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Healthcare made simple</p>
            </td>
          </tr>

          <!-- STATUS BANNER -->
          <tr>
            <td style="background:${content.bannerColor};padding:18px 40px;text-align:center;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${content.bannerText}</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0A1628;">
                Hello, ${name} 👋
              </h1>

              <!-- JOB CARD -->
              <div style="background:#f4f7fa;border-radius:12px;padding:16px 20px;border-left:4px solid ${content.bannerColor};margin-bottom:24px;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${content.bannerColor};text-transform:uppercase;letter-spacing:0.5px;">Position</p>
                <p style="margin:0;font-size:17px;font-weight:800;color:#0A1628;">${jobTitle}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6B7C93;">MedBook Health Platform</p>
              </div>

              <!-- HEADLINE -->
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0A1628;">${content.headline}</h2>

              <!-- BODY TEXT -->
              <p style="margin:0 0 20px;font-size:15px;color:#6B7C93;line-height:1.75;">${content.body}</p>

              <!-- NEXT STEPS -->
              <div style="background:#f4f7fa;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #0A1628;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#0A1628;text-transform:uppercase;letter-spacing:0.4px;">What Happens Next</p>
                <p style="margin:0;font-size:14px;color:#3D5170;line-height:1.65;">${content.next}</p>
              </div>

              <!-- TIP -->
              <div style="background:${content.tipColor};border-radius:10px;padding:14px 18px;border-left:3px solid ${content.tipBorder};margin-bottom:16px;">
                <p style="margin:0;font-size:13px;color:${content.tipText};line-height:1.6;">
                  💡 <strong>Note:</strong> ${content.tip}
                </p>
              </div>

              <!-- REPLY CTA -->
              <div style="background:#dbeafe;border-radius:10px;padding:14px 18px;border-left:3px solid #3b82f6;">
                <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                  💬 <strong>Have a question?</strong> Simply hit <strong>Reply</strong> in your email client and your message will reach our HR team directly inside our system.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f4f7fa;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#6B7C93;">
                © ${new Date().getFullYear()} MedBook Health Platform · Lagos, Nigeria
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#6B7C93;">
                Questions? <a href="mailto:careers@medbook.com" style="color:#0E9B8A;text-decoration:none;">careers@medbook.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};