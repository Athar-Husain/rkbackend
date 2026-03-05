import NotificationLog from "../models/NotificationLog.model.js";

/* GET MY NOTIFICATIONS */
export const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Standardized query: only filter by userId for maximum reliability
    const query = { userId: req.user._id };

    const notifications = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await NotificationLog.countDocuments(query);
    const unreadCount = await NotificationLog.countDocuments({
      ...query,
      isRead: false,
    });

    // console.log("notifications", notifications);
    res.status(200).json({
      success: true,
      unreadCount,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
      notifications,
    });
  } catch (err) {
    next(err);
  }
};

/* MARK SPECIFIC NOTIFICATIONS AS READ */
export const markNotificationsAsRead = async (req, res, next) => {
  try {
    const { ids } = req.body; // Expects an array of notification IDs

    await NotificationLog.updateMany(
      {
        _id: { $in: ids },
        userId: req.user._id, // Security check: ensures user owns the notification
      },
      { $set: { isRead: true } },
    );

    res.json({ success: true, message: "Notifications updated" });
  } catch (err) {
    next(err);
  }
};

/* MARK ALL NOTIFICATIONS AS READ (Global Clear) */
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    // No IDs needed; we mark everything for this user as read
    await NotificationLog.updateMany(
      {
        userId: req.user._id,
        isRead: false,
      },
      { $set: { isRead: true } },
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};
