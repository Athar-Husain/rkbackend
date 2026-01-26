import User from "../models/User.model.js";

/** Get logged-in user profile */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -deviceTokens",
    );
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/** Update user profile */
export const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ["name", "email", "mobile", "city", "area"];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
    }).select("-password -deviceTokens");
    res.status(200).json({ success: true, user, message: "Profile updated" });
  } catch (error) {
    next(error);
  }
};

/** Update user preferences */
export const updatePreferences = async (req, res, next) => {
  try {
    const { notifications, smsAlerts } = req.body;
    const updateFields = {};
    if (notifications !== undefined)
      updateFields["preferences.notifications"] = notifications;
    if (smsAlerts !== undefined)
      updateFields["preferences.smsAlerts"] = smsAlerts;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true },
    ).select("-password");
    res
      .status(200)
      .json({ success: true, user, message: "Preferences updated" });
  } catch (error) {
    next(error);
  }
};

/** Delete / deactivate account */
export const deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    user.isActive = false;
    await user.save();

    res.status(200).json({ success: true, message: "Account deactivated" });
  } catch (error) {
    next(error);
  }
};

/** Admin: Get all users with pagination */
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-password -deviceTokens")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.status(200).json({
      success: true,
      users,
      total,
      currentPage: page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

/** Admin: Get specific user */
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -deviceTokens",
    );
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/** Admin: Update user (role, wallet, etc) */
export const updateUserByAdmin = async (req, res, next) => {
  try {
    const allowedFields = [
      "name",
      "email",
      "mobile",
      "city",
      "area",
      "userType",
      "walletBalance",
      "isActive",
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).select("-password -deviceTokens");
    res.status(200).json({ success: true, user, message: "User updated" });
  } catch (error) {
    next(error);
  }
};

/** Admin: Delete user */
export const deleteUserByAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    await user.remove();
    res.status(200).json({ success: true, message: "User deleted" });
  } catch (error) {
    next(error);
  }
};
