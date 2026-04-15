import User from "../models/User.js";
import asyncHandler from "express-async-handler";

// @GET /api/admin/profile
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.user._id).select(
    "-password -resetPasswordToken -resetPasswordExpire -emailVerifyToken -emailVerifyExpire"
  );

  if (!admin || admin.role !== "admin") {
    res.status(404);
    throw new Error("Admin profile not found");
  }

  res.json({ success: true, admin });
});

// @PUT /api/admin/profile
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.user._id);

  if (!admin || admin.role !== "admin") {
    res.status(404);
    throw new Error("Admin profile not found");
  }

  const { name, phone, gender, dateOfBirth, address, avatar } = req.body;

  if (name)        admin.name        = name;
  if (phone)       admin.phone       = phone;
  if (gender)      admin.gender      = gender;
  if (dateOfBirth) admin.dateOfBirth = dateOfBirth;
  if (address)     admin.address     = address;
  if (avatar)      admin.avatar      = avatar;

  const updated = await admin.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    admin: {
      _id:             updated._id,
      name:            updated.name,
      email:           updated.email,
      phone:           updated.phone,
      gender:          updated.gender,
      dateOfBirth:     updated.dateOfBirth,
      address:         updated.address,
      avatar:          updated.avatar,
      role:            updated.role,
      isEmailVerified: updated.isEmailVerified,
      createdAt:       updated.createdAt,
    },
  });
});

// @PUT /api/admin/profile/change-password
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Please provide both current and new password");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const admin = await User.findById(req.user._id);

  const isMatch = await admin.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  admin.password = newPassword;
  await admin.save();

  res.json({ success: true, message: "Password changed successfully" });
});

// @PUT /api/admin/avatar
export const updateAdminAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No image file provided");
  }

  const admin = await User.findById(req.user._id);
  if (!admin || admin.role !== "admin") {
    res.status(404);
    throw new Error("Admin not found");
  }

  admin.avatar = req.file.path; // Cloudinary URL
  await admin.save();

  res.json({
    success: true,
    message: "Avatar updated successfully",
    avatar: admin.avatar,
  });
});