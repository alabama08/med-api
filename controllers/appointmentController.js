import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Notification from "../models/Notification.js";
import Conversation from "../models/Conversation.js"; // ← NEW
import Message from "../models/Message.js";           // ← NEW
import User from "../models/User.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find or create a conversation between two users, then create a
// system-style chat message. Wrapped so it never breaks the parent operation.
// ─────────────────────────────────────────────────────────────────────────────
const sendAutoMessage = async (senderId, receiverId, text, messageType = "appointment") => {
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    await Message.create({
      conversation: conversation._id,
      sender:       senderId,
      text,
      messageType,
    });

    // Update conversation preview
    conversation.lastMessage   = text.split("\n")[0]; // first line as preview
    conversation.lastMessageAt = new Date();
    await conversation.save();
  } catch (err) {
    // Never crash the parent request because of a messaging side-effect
    console.error("Auto-message failed:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @POST /api/appointments — Patient books appointment
// ─────────────────────────────────────────────────────────────────────────────
export const bookAppointment = async (req, res) => {
  const { doctorId, date, startTime, type, reason } = req.body;

  const doctorProfile = await DoctorProfile.findOne({ user: doctorId });
  if (!doctorProfile || !doctorProfile.isApproved) {
    res.status(404);
    throw new Error("Doctor not found or not approved");
  }

  // Check for conflicting appointment
  const conflict = await Appointment.findOne({
    doctor:    doctorId,
    date:      new Date(date),
    startTime,
    status:    { $in: ["pending", "confirmed"] },
  });
  if (conflict) {
    res.status(400);
    throw new Error("This time slot is already booked. Please choose another.");
  }

  const appointment = await Appointment.create({
    patient:         req.user._id,
    doctor:          doctorId,
    doctorProfile:   doctorProfile._id,
    date:            new Date(date),
    startTime,
    type:            type || "chat",
    reason:          reason || "",
    consultationFee: doctorProfile.consultationFee,
    status:          "pending",
  });

  // Notify doctor via push notification
  await Notification.create({
    user:    doctorId,
    title:   "New Appointment Request",
    message: `You have a new appointment request from ${req.user.name} on ${date} at ${startTime}.`,
    type:    "appointment",
    link:    "/doctor/appointments",
  });

  // ── Auto chat message: patient → doctor ──────────────────────────────────
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
  const apptMsgText = [
    "📅 *APPOINTMENT REQUEST*",
    `${req.user.name} has requested an appointment`,
    `Date: ${formattedDate} at ${startTime}`,
    `Type: ${(type || "chat").charAt(0).toUpperCase() + (type || "chat").slice(1)} Consultation`,
    reason ? `Reason: ${reason}` : null,
  ].filter(Boolean).join("\n");

  await sendAutoMessage(req.user._id, doctorId, apptMsgText, "appointment");
  // ─────────────────────────────────────────────────────────────────────────

  res.status(201).json({
    success: true,
    message: "Appointment booked successfully. Waiting for doctor confirmation.",
    appointment,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/appointments/my — Patient: get own appointments
// ─────────────────────────────────────────────────────────────────────────────
export const getMyAppointments = async (req, res) => {
  const appointments = await Appointment.find({ patient: req.user._id })
    .populate("doctor", "name avatar email")
    .populate("doctorProfile", "specialty consultationFee location")
    .sort({ date: -1 });

  res.json({ success: true, appointments });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/appointments/doctor — Doctor: get own appointments
// ─────────────────────────────────────────────────────────────────────────────
export const getDoctorAppointments = async (req, res) => {
  const appointments = await Appointment.find({ doctor: req.user._id })
    .populate("patient", "name avatar email phone gender dateOfBirth")
    .sort({ date: -1 });

  res.json({ success: true, appointments });
};

// ─────────────────────────────────────────────────────────────────────────────
// @PUT /api/appointments/:id/status — Doctor: confirm, reject, or complete
// ─────────────────────────────────────────────────────────────────────────────
export const updateAppointmentStatus = async (req, res) => {
  const { status, notes } = req.body;
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found");
  }
  if (appointment.doctor.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to update this appointment");
  }

  appointment.status = status;
  if (notes) appointment.notes = notes;
  await appointment.save();

  // Push notification to patient
  const statusMessages = {
    confirmed: "Your appointment has been confirmed by the doctor.",
    rejected:  "Your appointment request was declined by the doctor.",
    completed: "Your appointment has been marked as completed.",
  };
  if (statusMessages[status]) {
    await Notification.create({
      user:    appointment.patient,
      title:   `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: statusMessages[status],
      type:    "appointment",
      link:    "/patient/appointments",
    });
  }

  // ── Auto chat message: doctor → patient ──────────────────────────────────
  const formattedDate = appointment.date.toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

  let autoMsgText = null;

  if (status === "confirmed") {
    autoMsgText = [
      "✅ *APPOINTMENT CONFIRMED*",
      "Your appointment has been confirmed!",
      `Date: ${formattedDate} at ${appointment.startTime}`,
      `Type: ${appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)} Consultation`,
      "Please be available at the scheduled time.",
    ].join("\n");
  } else if (status === "rejected") {
    autoMsgText = [
      "❌ *APPOINTMENT DECLINED*",
      "Your appointment request was not accepted this time.",
      "Please feel free to book a different time slot.",
    ].join("\n");
  } else if (status === "completed") {
    autoMsgText = [
      "🏁 *APPOINTMENT COMPLETED*",
      "Your appointment has been marked as completed.",
      "Thank you for your visit! Please check your prescriptions tab for any medication prescribed.",
    ].join("\n");
  }

  if (autoMsgText) {
    await sendAutoMessage(req.user._id, appointment.patient, autoMsgText, "appointment");
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.json({ success: true, message: `Appointment ${status}`, appointment });
};

// ─────────────────────────────────────────────────────────────────────────────
// @PUT /api/appointments/:id/cancel — Patient or Doctor cancels
// ─────────────────────────────────────────────────────────────────────────────
export const cancelAppointment = async (req, res) => {
  const { cancelReason } = req.body;
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found");
  }

  const isPatient = appointment.patient.toString() === req.user._id.toString();
  const isDoctor  = appointment.doctor.toString()  === req.user._id.toString();

  if (!isPatient && !isDoctor) {
    res.status(403);
    throw new Error("Not authorized to cancel this appointment");
  }
  if (["completed", "cancelled"].includes(appointment.status)) {
    res.status(400);
    throw new Error("This appointment cannot be cancelled");
  }

  appointment.status       = "cancelled";
  appointment.cancelledBy  = isPatient ? "patient" : "doctor";
  appointment.cancelReason = cancelReason || "";
  await appointment.save();

  // Notify the other party
  const notifyUserId  = isPatient ? appointment.doctor  : appointment.patient;
  const cancellerName = req.user.name;

  await Notification.create({
    user:    notifyUserId,
    title:   "Appointment Cancelled",
    message: `Your appointment was cancelled by ${cancellerName}. Reason: ${cancelReason || "Not specified"}`,
    type:    "appointment",
    link:    isPatient ? "/doctor/appointments" : "/patient/appointments",
  });

  // ── Auto chat message: inform the other party ─────────────────────────────
  const cancelMsgText = [
    "🚫 *APPOINTMENT CANCELLED*",
    `Cancelled by: ${cancellerName}`,
    `Reason: ${cancelReason || "Not specified"}`,
    "You can book a new appointment anytime.",
  ].join("\n");

  await sendAutoMessage(req.user._id, notifyUserId, cancelMsgText, "appointment");
  // ─────────────────────────────────────────────────────────────────────────

  res.json({ success: true, message: "Appointment cancelled", appointment });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/appointments/:id — Get single appointment detail
// ─────────────────────────────────────────────────────────────────────────────
export const getAppointmentById = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate("patient",       "name avatar email phone gender dateOfBirth address")
    .populate("doctor",        "name avatar email")
    .populate("doctorProfile", "specialty consultationFee location");

  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found");
  }

  const isPatient = appointment.patient._id.toString() === req.user._id.toString();
  const isDoctor  = appointment.doctor._id.toString()  === req.user._id.toString();
  const isAdmin   = req.user.role === "admin";

  if (!isPatient && !isDoctor && !isAdmin) {
    res.status(403);
    throw new Error("Not authorized to view this appointment");
  }

  res.json({ success: true, appointment });
};