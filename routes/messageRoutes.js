import express from "express";
import {
  getConversations,
  getSuggestedUsers, // ← NEW
  getMessages,
  sendMessage,
  uploadChatFile,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadMessageFile } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/conversations",    protect, getConversations);

// ⚠️  IMPORTANT: "suggested-users" must be defined BEFORE "/:conversationId"
// otherwise Express would interpret the string "suggested-users" as a conversationId.
router.get("/suggested-users",  protect, getSuggestedUsers);

router.get("/:conversationId",  protect, getMessages);
router.post("/",                protect, sendMessage);
router.post("/upload",          protect, uploadMessageFile.single("file"), uploadChatFile);

export default router;