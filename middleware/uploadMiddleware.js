import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js"; // ← already configured, already validated

const makeStorage = (folder, transformations = []) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: transformations,
    },
  });

const avatarStorage = makeStorage("medbook/avatars", [
  { width: 400, height: 400, crop: "fill", gravity: "face" },
]);

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "medbook/documents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    resource_type:   "auto",
  },
});

const messageFileStorage = makeStorage("medbook/chat");

const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WebP images are allowed"), false);
  }
};

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadMessageFile = multer({
  storage: messageFileStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
});