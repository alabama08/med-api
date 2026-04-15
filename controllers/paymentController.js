import https from "https";
import Payment from "../models/Payment.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";

/* ── Internal helper: Paystack HTTPS requests ── */
const paystackRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Invalid JSON from Paystack"));
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

// ─────────────────────────────────────────────────────────────────
// @POST /api/payments/initialize
// Patient initiates payment.
// Works for pending, confirmed, AND completed (unpaid) appointments.
// ─────────────────────────────────────────────────────────────────
export const initializePayment = async (req, res) => {
  const { appointmentId } = req.body;

  if (!appointmentId) {
    res.status(400);
    throw new Error("appointmentId is required");
  }

  const appointment = await Appointment.findById(appointmentId).populate(
    "patient",
    "email name"
  );

  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found");
  }

  /* Only the patient who owns this appointment may pay */
  if (appointment.patient._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorised to pay for this appointment");
  }

  /* Guard: don't double-charge */
  if (appointment.isPaid) {
    res.status(400);
    throw new Error("This appointment has already been paid for");
  }

  /* Guard: can't pay for cancelled/rejected appointments */
  if (["cancelled", "rejected"].includes(appointment.status)) {
    res.status(400);
    throw new Error(`Cannot pay for a ${appointment.status} appointment`);
  }

  /* Paystack expects amount in the smallest currency unit (kobo for NGN) */
  const amountInKobo = Math.round(appointment.consultationFee * 100);

  const reference = `MEDBOOK-${appointmentId}-${Date.now()}`;

  const paystackData = await paystackRequest("POST", "/transaction/initialize", {
    email: appointment.patient.email,
    amount: amountInKobo,
    currency: "NGN",
    reference,
    metadata: {
      appointmentId: appointmentId.toString(),
      patientId: req.user._id.toString(),
      doctorId: appointment.doctor.toString(),
    },
    callback_url: `${process.env.CLIENT_URL}/payment/verify`,
  });

  if (!paystackData.status) {
    res.status(400);
    throw new Error(
      paystackData.message || "Payment initialisation failed. Please try again."
    );
  }

  /* Upsert: if there's already a pending record for this appointment, reuse it */
  await Payment.findOneAndUpdate(
    { appointment: appointmentId, status: "pending" },
    {
      patient: req.user._id,
      doctor: appointment.doctor,
      appointment: appointmentId,
      amount: appointment.consultationFee,
      currency: "NGN",
      paystackReference: paystackData.data.reference,
      paystackAccessCode: paystackData.data.access_code,
      status: "pending",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    success: true,
    authorizationUrl: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
  });
};

// ─────────────────────────────────────────────────────────────────
// @GET /api/payments/verify/:reference
// Called after Paystack redirects the patient back.
// KEY FIX: does NOT downgrade a "completed" appointment to "confirmed".
// ─────────────────────────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    res.status(400);
    throw new Error("Payment reference is required");
  }

  /* Ask Paystack whether the transaction succeeded */
  const paystackData = await paystackRequest(
    "GET",
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  if (!paystackData.status || paystackData.data?.status !== "success") {
    res.status(400);
    throw new Error(
      paystackData.data?.gateway_response ||
        "Payment verification failed. Please contact support."
    );
  }

  /* Find our local payment record */
  const payment = await Payment.findOne({ paystackReference: reference });
  if (!payment) {
    res.status(404);
    throw new Error("Payment record not found");
  }

  /* Idempotency: if already verified, just return success */
  if (payment.status === "success") {
    return res.json({ success: true, message: "Payment already verified", payment });
  }

  /* Update payment record */
  payment.status  = "success";
  payment.paidAt  = new Date();
  payment.channel = paystackData.data.channel ?? "";
  await payment.save();

  /* Update appointment: mark paid.
   * Only upgrade status to "confirmed" if it was still "pending".
   * Do NOT touch "completed" or "confirmed" — they are fine as-is. */
  const appointment = await Appointment.findById(payment.appointment);
  if (appointment) {
    appointment.isPaid = true;
    if (appointment.status === "pending") {
      appointment.status = "confirmed";
    }
    await appointment.save();
  }

  /* Notify doctor */
  await Notification.create({
    user: payment.doctor,
    title: "Payment Received 💰",
    message: `Payment of ₦${payment.amount.toLocaleString()} received for an appointment.`,
    type: "payment",
    link: "/doctor/earnings",
  });

  /* Notify patient */
  await Notification.create({
    user: payment.patient,
    title: "Payment Successful ✅",
    message: `Your payment of ₦${payment.amount.toLocaleString()} was successful. Appointment confirmed.`,
    type: "payment",
    link: "/patient/appointments",
  });

  res.json({ success: true, message: "Payment successful", payment });
};

// ─────────────────────────────────────────────────────────────────
// @GET /api/payments/my — Patient: own payment history
// ─────────────────────────────────────────────────────────────────
export const getMyPayments = async (req, res) => {
  const payments = await Payment.find({ patient: req.user._id })
    .populate("doctor", "name avatar")
    .populate("appointment", "date startTime status type")
    .sort({ createdAt: -1 });

  res.json({ success: true, payments });
};

// ─────────────────────────────────────────────────────────────────
// @GET /api/payments/earnings — Doctor: earnings
// ─────────────────────────────────────────────────────────────────
export const getDoctorEarnings = async (req, res) => {
  const payments = await Payment.find({
    doctor: req.user._id,
    status: "success",
  })
    .populate("patient", "name avatar")
    .populate("appointment", "date startTime type")
    .sort({ createdAt: -1 });

  const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({ success: true, payments, totalEarnings });
};