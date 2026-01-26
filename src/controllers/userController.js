import User from "../models/User.model.js";
import Referral from "../models/Referral.model.js";
import Coupon from "../models/Coupon.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import bcrypt from "bcryptjs";

/** Helper to issue referral rewards */
const issueReferralRewards = async (referral) => {
  try {
    // Referrer reward
    const referrerCoupon = await Coupon.create({
      code: `REFERRAL-REFERRER-${referral.referrerId.toString().slice(-6)}`,
      title: "Referral Bonus - ₹500 Off",
      description: "Reward for successful referral",
      type: "FIXED_AMOUNT",
      value: referral.rewards?.referrer?.amount || 500,
      minPurchaseAmount: 10000,
      targeting: { type: "INDIVIDUAL", users: [referral.referrerId] },
      productRules: { type: "ALL_PRODUCTS" },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: "ACTIVE",
    });

    await UserCoupon.create({
      userId: referral.referrerId,
      couponId: referrerCoupon._id,
    });

    referral.rewards.referrer = {
      ...referral.rewards.referrer,
      couponId: referrerCoupon._id,
      status: "ISSUED",
      issuedAt: new Date(),
    };

    // Referred user reward
    const referredCoupon = await Coupon.create({
      code: `REFERRAL-REFERRED-${referral.referredUserId.toString().slice(-6)}`,
      title: "Welcome Bonus - ₹300 Off",
      description: "Welcome reward for joining through referral",
      type: "FIXED_AMOUNT",
      value: referral.rewards?.referred?.amount || 300,
      minPurchaseAmount: 5000,
      targeting: { type: "INDIVIDUAL", users: [referral.referredUserId] },
      productRules: { type: "ALL_PRODUCTS" },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    });

    await UserCoupon.create({
      userId: referral.referredUserId,
      couponId: referredCoupon._id,
    });

    referral.rewards.referred = {
      ...referral.rewards.referred,
      couponId: referredCoupon._id,
      status: "ISSUED",
      issuedAt: new Date(),
    };

    await referral.save();
  } catch (error) {
    console.error("Error issuing referral rewards:", error);
  }
};

/** Register new user (with optional referral code) */
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, mobile, password, city, area, referralCode } =
      req.body;

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email or Mobile already exists" });
    }

    let referredBy = null;

    // Validate referral code
    if (referralCode) {
      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (!referrer) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid referral code" });
      }
      referredBy = referrer._id;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      city,
      area,
      referredBy,
    });

    // If referred, create referral document and issue rewards
    if (referredBy) {
      const referral = await Referral.create({
        referrerId: referredBy,
        referredUserId: newUser._id,
      });
      await issueReferralRewards(referral);
    }

    res.status(201).json({
      success: true,
      user: newUser,
      message: "User registered successfully",
    });
  } catch (error) {
    next(error);
  }
};

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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/** Admin: Update user */
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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await user.remove();
    res.status(200).json({ success: true, message: "User deleted" });
  } catch (error) {
    next(error);
  }
};
