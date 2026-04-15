import Prescription from "../models/Prescription.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";

// @POST /api/prescriptions — Doctor writes prescription
export const writePrescription = async (req, res) => {
  const {
    patientId,
    appointmentId,
    medications,
    diagnosis,
    notes,
    followUpDate,
  } = req.body;

  if (!medications || medications.length === 0) {
    res.status(400);
    throw new Error("At least one medication is required");
  }

  const prescription = await Prescription.create({
    doctor: req.user._id,
    patient: patientId,
    appointment: appointmentId || null,
    medications,
    diagnosis: diagnosis || "",
    notes: notes || "",
    followUpDate: followUpDate ? new Date(followUpDate) : null,
  });

  // Notify patient
  await Notification.create({
    user: patientId,
    title: "New Prescription",
    message: "Your doctor has written a new prescription for you.",
    type: "prescription",
    link: "/patient/prescriptions",
  });

  res.status(201).json({
    success: true,
    message: "Prescription created successfully",
    prescription,
  });
};

// @GET /api/prescriptions/my — Patient: get own prescriptions
export const getMyPrescriptions = async (req, res) => {
  const prescriptions = await Prescription.find({ patient: req.user._id })
    .populate("doctor", "name avatar email")
    .populate("appointment", "date startTime")
    .sort({ createdAt: -1 });

  res.json({ success: true, prescriptions });
};

// @GET /api/prescriptions/doctor — Doctor: get prescriptions they wrote
export const getDoctorPrescriptions = async (req, res) => {
  const prescriptions = await Prescription.find({ doctor: req.user._id })
    .populate("patient", "name avatar email")
    .populate("appointment", "date startTime")
    .sort({ createdAt: -1 });

  res.json({ success: true, prescriptions });
};

// @GET /api/prescriptions/:id — Get single prescription
export const getPrescriptionById = async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate("doctor", "name avatar email")
    .populate("patient", "name avatar email dateOfBirth gender")
    .populate("appointment", "date startTime type");

  if (!prescription) {
    res.status(404);
    throw new Error("Prescription not found");
  }

  const isPatient = prescription.patient._id.toString() === req.user._id.toString();
  const isDoctor = prescription.doctor._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isPatient && !isDoctor && !isAdmin) {
    res.status(403);
    throw new Error("Not authorized to view this prescription");
  }

  res.json({ success: true, prescription });
};

// @PUT /api/prescriptions/:id — Doctor updates prescription
export const updatePrescription = async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    res.status(404);
    throw new Error("Prescription not found");
  }

  if (prescription.doctor.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to edit this prescription");
  }

  const { medications, diagnosis, notes, followUpDate, isActive } = req.body;

  if (medications) prescription.medications = medications;
  if (diagnosis) prescription.diagnosis = diagnosis;
  if (notes) prescription.notes = notes;
  if (followUpDate) prescription.followUpDate = new Date(followUpDate);
  if (isActive !== undefined) prescription.isActive = isActive;

  await prescription.save();

  res.json({ success: true, message: "Prescription updated", prescription });
};