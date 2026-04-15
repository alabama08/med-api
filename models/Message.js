import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    fileType: {
      type: String, // "image" | "pdf" | ""
      default: "",
    },
    messageType: {
      type: String,
      // ← "appointment" added so booking/confirm/complete/reject auto-messages work
      enum: ["text", "prescription", "complaint", "appointment"],
      default: "text",
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;