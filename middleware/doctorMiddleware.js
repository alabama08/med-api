import DoctorProfile from "../models/DoctorProfile.js";

export const approvedDoctorOnly = async (req, res, next) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id });

  if (profile && profile.isApproved) {
    next();
  } else {
    res.status(403);
    throw new Error("Your doctor account is pending admin approval");
  }
};