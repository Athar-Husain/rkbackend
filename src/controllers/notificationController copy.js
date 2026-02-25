// import NotificationLog from "../models/NotificationLog.js";

import NotificationLog from "../models/NotificationLog.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    // Determine user type from the request (set by your auth middleware)
    // Example: if req.admin exists, type is 'Admin'
    const userModel = req.admin ? 'admin' : req.staff ? 'staff' : 'user';
    const userId = req.user?._id || req.staff?._id || req.admin?._id;

    const notifications = await NotificationLog.find({
      userId: userId,
      userModel: userModel
    })
    .sort({ createdAt: -1 }) // Newest first
    .limit(50);

    const unreadCount = await NotificationLog.countDocuments({
      userId: userId,
      userModel: userModel,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await NotificationLog.updateMany(
      { _id: { $in: req.body.notificationIds } },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: "Marked as read" });
  } catch (error) {
    next(error);
  }
};