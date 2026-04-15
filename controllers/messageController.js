import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Appointment from "../models/Appointment.js"; // ← NEW import

// @GET /api/messages/conversations
export const getConversations = async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
    isActive: true,
  })
    .populate("participants", "name avatar role")
    .sort({ lastMessageAt: -1 });

  res.json({ success: true, conversations });
};

// ─────────────────────────────────────────────────────────────────────────────
// @GET /api/messages/suggested-users
// Returns users the logged-in user shares an appointment with.
//   • patient → their doctors (from any appointment, any status)
//   • doctor  → their patients (from any appointment, any status)
// Used to pre-populate the search dropdown without typing.
// ─────────────────────────────────────────────────────────────────────────────
export const getSuggestedUsers = async (req, res) => {
  const userId = req.user._id;
  const role   = req.user.role;

  let users = [];

  if (role === "patient") {
    // All appointments for this patient — get unique doctors
    const appointments = await Appointment.find({ patient: userId })
      .populate("doctor", "name avatar email")
      .lean();

    const seen = new Set();
    users = appointments.reduce((acc, a) => {
      if (!a.doctor) return acc;
      const id = a.doctor._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        acc.push(a.doctor);
      }
      return acc;
    }, []);
  } else if (role === "doctor") {
    // All appointments sent TO this doctor — get unique patients
    const appointments = await Appointment.find({ doctor: userId })
      .populate("patient", "name avatar email")
      .lean();

    const seen = new Set();
    users = appointments.reduce((acc, a) => {
      if (!a.patient) return acc;
      const id = a.patient._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        acc.push(a.patient);
      }
      return acc;
    }, []);
  }

  res.json({ success: true, users });
};

// @GET /api/messages/:conversationId
export const getMessages = async (req, res) => {
  const conversation = await Conversation.findById(req.params.conversationId);

  if (!conversation) {
    res.status(404);
    throw new Error("Conversation not found");
  }

  const isParticipant = conversation.participants
    .map((p) => p.toString())
    .includes(req.user._id.toString());

  if (!isParticipant) {
    res.status(403);
    throw new Error("Not authorized to view this conversation");
  }

  const messages = await Message.find({
    conversation: req.params.conversationId,
  })
    .populate("sender", "name avatar")
    .sort({ createdAt: 1 });

  // Mark messages as read
  await Message.updateMany(
    {
      conversation: req.params.conversationId,
      sender: { $ne: req.user._id },
      isRead: false,
    },
    { isRead: true }
  );

  res.json({ success: true, messages });
};

// @POST /api/messages
export const sendMessage = async (req, res) => {
  const {
    conversationId,
    receiverId,
    text,
    fileUrl,
    fileType,
    messageType,      // "text" | "prescription" | "complaint"
    prescriptionId,   // optional: link to Prescription doc
  } = req.body;

  let conversation;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
  } else if (receiverId) {
    conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, receiverId],
      });
    }
  }

  if (!conversation) {
    res.status(400);
    throw new Error("Conversation could not be found or created");
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text: text || "",
    fileUrl: fileUrl || "",
    fileType: fileType || "",
    messageType: messageType || "text",
    prescriptionId: prescriptionId || null,
  });

  // Update conversation preview
  const previewText =
    messageType === "prescription" ? "💊 Prescription sent"
    : messageType === "complaint"  ? "⚠️ Complaint sent"
    : text || "Sent a file";

  conversation.lastMessage   = previewText;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const populatedMessage = await Message.findById(message._id).populate(
    "sender",
    "name avatar"
  );

  // Notify the other participant
  const receiverIdFinal =
    receiverId ||
    conversation.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

  const notificationTitle =
    messageType === "prescription" ? "New Prescription 💊"
    : messageType === "complaint"  ? "New Complaint ⚠️"
    : "New Message";

  const notificationMsg =
    messageType === "prescription"
      ? `Dr. ${req.user.name} sent you a prescription.`
      : messageType === "complaint"
      ? `${req.user.name} has lodged a complaint.`
      : `${req.user.name} sent you a message.`;

  const notificationLink =
    req.user.role === "doctor"
      ? "/doctor/messages"
      : "/patient/messages";

  await Notification.create({
    user:    receiverIdFinal,
    title:   notificationTitle,
    message: notificationMsg,
    type:    "message",
    link:    notificationLink,
  });

  res.status(201).json({
    success:        true,
    message:        populatedMessage,
    conversationId: conversation._id,
  });
};

// @POST /api/messages/upload
export const uploadChatFile = async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  res.json({
    success:  true,
    fileUrl:  req.file.path,
    fileType: req.file.mimetype.startsWith("image") ? "image" : "pdf",
  });
};