import User from "../models/User.model.js";
import NotificationService from "../services/notificationService.js";
import Referral from "../models/Referral.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import Purchase from "../models/Purchase.model.js";
import TargetingService from "../services/targetingService.js";
import asyncHandler from "express-async-handler";
import { generateToken } from "../middleware/auth.js";
import { formatCurrency } from "../utils/common.js";
import {
  generatePurposeOTP,
  verifyPurposeOTP,
  checkOTPExists,
  sendOTPSMS, // Assuming this is your external SMS trigger
} from "../services/otpService.js";

// ================================
// 1. Send OTP (Login/Register)
// ================================
export const sendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res
      .status(400)
      .json({ success: false, message: "Mobile number is required" });
  }

  const user = await User.findOne({ mobile });
  const isResend = await checkOTPExists(mobile);

  // Generate and send OTP via your service
  const result = await sendOTPSMS(mobile, isResend);

  res.status(200).json({
    success: true,
    message: result.message,
    userExists: !!user,
    otp: process.env.NODE_ENV === "development" ? result.otp : undefined,
  });
});

// ================================
// 2. Verify OTP & Onboard
// ================================
export const verifyOTP = asyncHandler(async (req, res) => {
  const { mobile, otp, name, city, area, referralCode } = req.body;

  // 1. Verify OTP
  const otpResult = await verifyPurposeOTP(mobile, "LOGIN", otp);
  if (!otpResult.success) {
    return res.status(400).json({ success: false, message: otpResult.error });
  }

  let user = await User.findOne({ mobile });
  let isNewUser = false;

  if (!user) {
    // Check for required registration fields
    if (!name || !city || !area) {
      return res.status(400).json({
        success: false,
        message: "Registration requires Name, City, and Area",
      });
    }

    // 2. Sanitize Location (The Jagruti-nagar Logic)
    const formattedCity = city.trim().toUpperCase();
    const formattedArea = area.trim().toUpperCase().replace(/\s+/g, "-");

    // 3. Handle Referral
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (referrer) referredBy = referrer._id;
    }

    // 4. Create User
    user = await User.create({
      mobile,
      name,
      city: formattedCity,
      area: formattedArea,
      referredBy,
      isVerified: true,
    });

    isNewUser = true;

    // Handle Referral Reward Logic
    if (referredBy) {
      await Referral.create({
        referrerId: referredBy,
        referredUserId: user._id,
        status: "COMPLETED",
      });
      // Notify Referrer
      await NotificationService.sendPushNotification(
        referredBy,
        "Referral Bonus!",
        `${name} joined! Check your wallet for rewards.`,
      );
    }

    await NotificationService.sendSMS(
      mobile,
      `Welcome to RK Electronics, ${name}!`,
    );
  } else {
    user.lastLogin = new Date();
    await user.save();
  }

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    isNewUser,
    user: {
      id: user._id,
      name: user.name,
      city: user.city,
      area: user.area,
      mobile: user.mobile,
      referralCode: user.referralCode,
    },
  });
});

// ================================
// 3. Dashboard (Consolidated Data)
// ================================
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Run database queries in parallel for speed
  const [user, activeCoupons, purchaseStats, referralStats] = await Promise.all(
    [
      User.findById(userId).select("-deviceTokens"),
      UserCoupon.countDocuments({ userId, status: "ACTIVE" }),
      Purchase.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            total: { $sum: "$finalAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Referral.getUserStats(userId),
    ],
  );

  const totalSpent = purchaseStats[0]?.total || 0;

  // Get Personalized Offers (AC Buyers vs Non-Washing Machine owners)
  const recommendations =
    await TargetingService.getPersonalizedRecommendations(userId);

  res.status(200).json({
    success: true,
    user,
    stats: {
      activeCoupons,
      totalPurchases: purchaseStats[0]?.count || 0,
      totalSpent,
      formattedTotalSpent: formatCurrency(totalSpent),
      ...referralStats,
    },
    recommendations,
  });
});

// ================================
// 4. Register Device (FCM Targeting)
// ================================
export const registerDevice = asyncHandler(async (req, res) => {
  const { token, platform = "android" } = req.body;

  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Token is required" });
  }

  // Update or Add the device token to the user document
  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { deviceTokens: { token, platform, lastUsed: new Date() } },
  });

  res
    .status(200)
    .json({ success: true, message: "Device registered for targeting" });
});
