import Notification from "../models/Notification.js";

// @GET /api/notifications — Get all notifications for logged in user
export const getNotifications = async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, notifications });
};

// @PUT /api/notifications/:id/read — Mark one as read
export const markAsRead = async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized");
  }

  notification.isRead = true;
  await notification.save();

  res.json({ success: true, message: "Marked as read" });
};

// @PUT /api/notifications/mark-all-read — Mark all as read
export const markAllAsRead = async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );

  res.json({ success: true, message: "All notifications marked as read" });
};

// @DELETE /api/notifications/:id — Delete one notification
export const deleteNotification = async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized");
  }

  await notification.deleteOne();
  res.json({ success: true, message: "Notification deleted" });
};