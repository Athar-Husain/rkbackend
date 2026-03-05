import NotificationLog from "../models/NotificationLog.model.js";

/* GET MY NOTIFICATIONS */
// export const getMyNotifications = async (req, res, next) => {
//   try {
//     const { page = 1, limit = 20 } = req.query;

//     // console.log("req user", req.user)

//     const query = {
//       userId: req.user._id,
//       userModel: req.user.userType,
//     };

//     const notifications = await NotificationLog.find(query)
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit));

//     const total = await NotificationLog.countDocuments(query);

//     const unreadCount = await NotificationLog.countDocuments({
//       ...query,
//       isRead: false,
//     });

//     console.log("notification in controllers", notifications);
//     res.status(200).json({
//       success: true,
//       unreadCount,
//       pagination: {
//         total,
//         page: Number(page),
//         pages: Math.ceil(total / limit),
//       },
//       notifications,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const getMyNotifications2 = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    console.log("--- 🔍 NOTIFICATION DEBUG START ---");
    console.log("Logged in User ID:", req.user._id);
    console.log("Logged in User Type (req.user.userType):", req.user.userType);

    // 1. Let's see if ANY logs exist for this ID regardless of userModel
    const rawCheck = await NotificationLog.findOne({ userId: req.user._id });
    if (rawCheck) {
      console.log("✅ Match found by ID! But check the model field:");
      console.log("Model stored in DB for this log:", rawCheck.userModel);
    } else {
      console.log("❌ No logs found for this User ID in the DB.");
    }

    const query = {
      userId: req.user._id,
      userModel: req.user.userType, // This is the likely point of failure
    };

    const notifications = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    console.log("--- 🔍 DEBUG END ---");

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

export const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // We only filter by userId now
    const query = {
      userId: req.user._id,
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
        userModel: req.user.userType,
      },
      { $set: { isRead: true } },
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
        // userModel: req.userModel,
        userModel: req.user.userType,
      },
      { $set: { isRead: true } },
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
