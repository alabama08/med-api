import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Review from "../models/Review.js";

// @GET /api/doctors
export const getAllDoctors = async (req, res, next) => {
  try {
    const { specialty, city, name, minRating, page = 1, limit = 12 } = req.query;

    const profileQuery = { isApproved: true };
    if (specialty) profileQuery.specialty = { $regex: specialty, $options: "i" };
    if (city)      profileQuery["location.city"] = { $regex: city, $options: "i" };
    if (minRating) profileQuery.averageRating = { $gte: Number(minRating) };

    let profiles = await DoctorProfile.find(profileQuery)
      .populate("user", "name email avatar gender")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ averageRating: -1 });

    if (name) {
      profiles = profiles.filter((p) =>
        p.user?.name?.toLowerCase().includes(name.toLowerCase())
      );
    }

    const total = await DoctorProfile.countDocuments(profileQuery);

    res.json({
      success: true,
      doctors: profiles,
      total,
      page:  Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/doctors/:id
export const getDoctorById = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.params.id }).populate(
      "user", "name email avatar gender phone"
    );

    if (!profile) {
      res.status(404);
      return next(new Error("Doctor not found"));
    }

    const reviews = await Review.find({ doctor: req.params.id })
      .populate("patient", "name avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, doctor: profile, reviews });
  } catch (error) {
    next(error);
  }
};

// @GET /api/doctors/me  or  /api/doctors/my-profile
export const getMyDoctorProfile = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.user._id }).populate(
      "user", "name email avatar phone gender"
    );

    if (!profile) {
      res.status(404);
      return next(new Error("Doctor profile not found"));
    }

    res.json({ success: true, profile });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/doctors/profile
export const updateDoctorProfile = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.user._id });
    if (!profile) {
      res.status(404);
      return next(new Error("Doctor profile not found"));
    }

    const {
      specialty, bio, experience, consultationFee, currency,
      location, languages, qualifications, licenseNumber,
      bankDetails, isAvailableForChat,
    } = req.body;

    if (specialty)                  profile.specialty        = specialty;
    if (bio)                        profile.bio              = bio;
    if (experience !== undefined)   profile.experience       = experience;
    if (consultationFee !== undefined) profile.consultationFee = consultationFee;
    if (currency)                   profile.currency         = currency;
    if (location)                   profile.location         = { ...profile.location, ...location };
    if (languages)                  profile.languages        = languages;
    if (qualifications)             profile.qualifications   = qualifications;
    if (licenseNumber)              profile.licenseNumber    = licenseNumber;
    if (bankDetails)                profile.bankDetails      = { ...profile.bankDetails, ...bankDetails };
    if (isAvailableForChat !== undefined) profile.isAvailableForChat = isAvailableForChat;

    await profile.save();
    res.json({ success: true, message: "Profile updated successfully", profile });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/doctors/avatar
export const uploadAvatar = async (req, res, next) => {
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

// @GET /api/doctors/:id/availability
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.params.id }).select(
      "availability consultationFee"
    );

    if (!profile) {
      res.status(404);
      return next(new Error("Doctor not found"));
    }

    res.json({
      success:         true,
      availability:    profile.availability,
      consultationFee: profile.consultationFee,
    });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/doctors/availability
export const updateAvailability = async (req, res, next) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.user._id });
    if (!profile) {
      res.status(404);
      return next(new Error("Doctor profile not found"));
    }

    profile.availability = req.body.availability;
    await profile.save();

    res.json({
      success:      true,
      message:      "Availability updated",
      availability: profile.availability,
    });
  } catch (error) {
    next(error);
  }
};