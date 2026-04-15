import mongoose from "mongoose";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Appointment from "../models/Appointment.js";
import Payment from "../models/Payment.js";
import Notification from "../models/Notification.js";

/* ── Helper: reject requests whose :id param is not a valid ObjectId ── */
const assertValidId = (id, res) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid or missing ID: "${id}"`);
  }
};

// @GET /api/admin/stats — Dashboard summary
export const getStats = async (req, res) => {
  const totalPatients = await User.countDocuments({ role: "patient" });
  const totalDoctors = await User.countDocuments({ role: "doctor" });
  const pendingDoctors = await DoctorProfile.countDocuments({ isApproved: false });
  const totalAppointments = await Appointment.countDocuments();
  const completedAppointments = await Appointment.countDocuments({ status: "completed" });
  const totalRevenue = await Payment.aggregate([
    { $match: { status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({
    success: true,
    stats: {
      totalPatients,
      totalDoctors,
      pendingDoctors,
      totalAppointments,
      completedAppointments,
      totalRevenue: totalRevenue[0]?.total || 0,
    },
  });
};

// @GET /api/admin/doctors — Get all doctors with profile
export const getAllDoctors = async (req, res) => {
  const { approved } = req.query;
  const query = {};
  if (approved === "false") query.isApproved = false;
  if (approved === "true")  query.isApproved = true;

  const profiles = await DoctorProfile.find(query)
    .populate("user", "name email avatar phone createdAt isActive")
    .sort({ createdAt: -1 });

  res.json({ success: true, doctors: profiles });
};

// @PUT /api/admin/doctors/:id/approve — Approve a doctor
export const approveDoctor = async (req, res) => {
  assertValidId(req.params.id, res);

  const profile = await DoctorProfile.findOne({ user: req.params.id });
  if (!profile) {
    res.status(404);
    throw new Error("Doctor profile not found");
  }

  profile.isApproved = true;
  await profile.save();

  await Notification.create({
    user: req.params.id,
    title: "Account Approved! 🎉",
    message:
      "Congratulations! Your doctor account has been approved. You can now receive appointments.",
    type: "system",
    link: "/doctor/dashboard",
  });

  res.json({ success: true, message: "Doctor approved successfully" });
};

// @PUT /api/admin/doctors/:id/reject — Reject / revoke a doctor
export const rejectDoctor = async (req, res) => {
  assertValidId(req.params.id, res);

  const profile = await DoctorProfile.findOne({ user: req.params.id });
  if (!profile) {
    res.status(404);
    throw new Error("Doctor profile not found");
  }

  profile.isApproved = false;
  await profile.save();

  await Notification.create({
    user: req.params.id,
    title: "Account Not Approved",
    message:
      "Your doctor account application was not approved at this time. Please contact support for more information.",
    type: "system",
    link: "/doctor/profile",
  });

  res.json({ success: true, message: "Doctor rejected" });
};

// @GET /api/admin/patients — Get all patients
export const getAllPatients = async (req, res) => {
  const patients = await User.find({ role: "patient" })
    .select("-password")
    .sort({ createdAt: -1 });

  res.json({ success: true, patients });
};

// @PUT /api/admin/users/:id/toggle — Activate or deactivate any user
export const toggleUserActive = async (req, res) => {
  /* This is where the crash was: req.params.id was the string "null" */
  assertValidId(req.params.id, res);

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
  });
};

// @GET /api/admin/appointments — Get all appointments
export const getAllAppointments = async (req, res) => {
  const appointments = await Appointment.find()
    .populate("patient", "name email avatar")
    .populate("doctor", "name email avatar")
    .sort({ createdAt: -1 });

  res.json({ success: true, appointments });
};

// @GET /api/admin/payments — Get all payments
export const getAllPayments = async (req, res) => {
  const payments = await Payment.find()
    .populate("patient", "name email")
    .populate("doctor", "name email")
    .populate("appointment", "date startTime status")
    .sort({ createdAt: -1 });

  const totalRevenue = payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + p.amount, 0);

  res.json({ success: true, payments, totalRevenue });
};

// @DELETE /api/admin/users/:id — Admin deletes a user account
export const deleteUser = async (req, res) => {
  assertValidId(req.params.id, res);

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.role === "admin") {
    res.status(400);
    throw new Error("Cannot delete an admin account");
  }

  await user.deleteOne();
  res.json({ success: true, message: "User deleted successfully" });
};

// @DELETE /api/admin/doctor-profiles/:profileId — Delete an orphaned DoctorProfile
export const deleteDoctorProfile = async (req, res) => {
  assertValidId(req.params.profileId, res);

  const profile = await DoctorProfile.findById(req.params.profileId);
  if (!profile) {
    res.status(404);
    throw new Error("Doctor profile not found");
  }

  await profile.deleteOne();
  res.json({ success: true, message: "Doctor profile deleted successfully" });
};

// @GET /api/admin/profile
export const getAdminProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) { res.status(404); throw new Error("Admin not found"); }
  res.json({ success: true, admin: user });
};

// @PUT /api/admin/profile
export const updateAdminProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error("Admin not found"); }
  const { name, phone, gender, dateOfBirth, address, avatar } = req.body;
  if (name)        user.name        = name;
  if (phone)       user.phone       = phone;
  if (gender)      user.gender      = gender;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;
  if (address)     user.address     = address;
  if (avatar)      user.avatar      = avatar;
  await user.save();
  const updated = await User.findById(user._id).select("-password");
  res.json({ success: true, message: "Profile updated successfully", admin: updated });
};

// @PUT /api/admin/profile/change-password
export const changeAdminPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error("Admin not found"); }
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) { res.status(400); throw new Error("Current password is incorrect"); }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password changed successfully" });
};