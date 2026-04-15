import crypto from "crypto";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import { generateToken } from "../utils/generateToken.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";

// @POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const {
      name, email, password, role, phone,
      specialty, licenseNumber, consultationFee,
    } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      return next(new Error("Email already registered"));
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email,
      password,
      role: role === "doctor" ? "doctor" : "patient",
      phone,
      emailVerifyToken:  verifyToken,
      emailVerifyExpire: Date.now() + 24 * 60 * 60 * 1000,
    });

    if (role === "doctor") {
      await DoctorProfile.create({
        user:            user._id,
        specialty:       specialty       || "",
        licenseNumber:   licenseNumber   || "",
        consultationFee: consultationFee || 0,
      });
    }

    // Send verification email — if this fails, delete the user so they can retry cleanly
    try {
      await sendVerificationEmail(email, verifyToken, name);
    } catch (emailError) {
      console.error("❌ Verification email failed, rolling back user creation:", emailError.message);
      await User.findByIdAndDelete(user._id);
      res.status(500);
      return next(new Error("Account created but verification email could not be sent. Please try again or contact support."));
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      return next(new Error("Invalid email or password"));
    }

    if (!user.isEmailVerified) {
      res.status(403);
      return next(new Error("Please verify your email before logging in"));
    }

    if (!user.isActive) {
      res.status(403);
      return next(new Error("Your account has been deactivated. Contact support."));
    }

    generateToken(res, user._id);

    res.json({
      success: true,
      user: {
        _id:    user._id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        avatar: user.avatar,
        phone:  user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/auth/logout
export const logout = (req, res, next) => {
  try {
    res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

// @GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @GET /api/auth/verify-email/:token
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({
      emailVerifyToken:  req.params.token,
      emailVerifyExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Verification link is invalid or has already been used. If you already verified your email, please login.",
      });
    }

    user.isEmailVerified   = true;
    user.emailVerifyToken  = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully. You can now login.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      res.status(404);
      return next(new Error("No account found with that email"));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken  = resetToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    await user.save();

    // ✅ Fixed: pass user.name as the third argument
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);
    } catch (emailError) {
      // Roll back the token so the user can try again
      user.resetPasswordToken  = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      res.status(500);
      return next(new Error("Password reset email could not be sent. Please try again."));
    }

    res.json({ success: true, message: "Password reset email sent. Please check your inbox." });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/auth/reset-password/:token
export const resetPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetPasswordToken:  req.params.token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400);
      return next(new Error("Invalid or expired reset token"));
    }

    user.password            = req.body.password;
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/auth/update-profile
export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }

    const { name, phone, gender, address, dateOfBirth, state } = req.body;

    if (name)        user.name        = name;
    if (phone)       user.phone       = phone;
    if (gender)      user.gender      = gender;
    if (address)     user.address     = address;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (state)       user.state       = state;

    await user.save();
    const updated = await User.findById(user._id).select("-password");
    res.json({ success: true, user: updated });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/auth/change-password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      return next(new Error("Please provide both current and new password"));
    }

    if (newPassword.length < 6) {
      res.status(400);
      return next(new Error("New password must be at least 6 characters"));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      res.status(400);
      return next(new Error("Current password is incorrect"));
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/auth/avatar
export const updateUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      return next(
        new Error("No file uploaded. Please select a JPG, PNG, or WebP image under 5MB.")
      );
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }

    const avatarUrl = req.file.path || req.file.filename;

    user.avatar = avatarUrl;
    await user.save();

    res.json({
      success: true,
      avatar:  avatarUrl,
      message: "Profile photo updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search users by role + name query
 * GET /api/users/search?role=doctor&q=john
 */
export const searchUsers = async (req, res) => {
  const { role, q = "" } = req.query;
 
  if (!role) {
    res.status(400);
    throw new Error("role query param is required (doctor | patient)");
  }
 
  const filter = {
    role,
    _id: { $ne: req.user._id },          // exclude self
    ...(q.trim()
      ? { name: { $regex: q.trim(), $options: "i" } }
      : {}),
  };
 
  const users = await User.find(filter)
    .select("name avatar email role")
    .limit(20)
    .sort({ name: 1 });
 
  res.json({ success: true, users });
};