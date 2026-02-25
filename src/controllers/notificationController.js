import NotificationLog from "../models/NotificationLog.js";

/* GET MY NOTIFICATIONS */
export const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = {
      userId: req.user._id,
      userModel: req.userModel,
    };

    const notifications = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await NotificationLog.countDocuments(query);

    const unreadCount = await NotificationLog.countDocuments({
      ...query,
      isRead: false,
    });

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

/* MARK AS READ */
export const markNotificationsAsRead = async (req, res, next) => {
  try {
    const { ids } = req.body;

    await NotificationLog.updateMany(
      {
        _id: { $in: ids },
        userId: req.user._id,
        userModel: req.userModel,
      },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const { ids } = req.body;

    await NotificationLog.updateMany(
      {
        _id: { $in: ids },
        userId: req.user._id,
        userModel: req.userModel,
      },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};