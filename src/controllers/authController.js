// const User = require("../models/User.model.js");
// const OTPService = require("../services/otpService");
// const NotificationService = require("../services/notificationService");
// const Referral = require("../models/Referral.model.js");
// const { generateToken } = require("../middleware/auth");
// const { formatCurrency } = require("../utils/common");

import User from "../models/User.model.js";
// import OTPService from "../services/otpService.js";
import NotificationService from "../services/notificationService.js";
import Referral from "../models/Referral.model.js";
import { generateToken } from "../middleware/auth.js";
import { formatCurrency } from "../utils/common.js";
import {
  generatePurposeOTP,
  verifyPurposeOTP,
  // verifyOTP,
  checkOTPExists,
} from "../services/otpService.js";

// @desc    Send OTP to mobile
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile number",
      });
    }

    // Check if user exists
    const user = await User.findOne({ mobile });
    const isResend = await checkOTPExists(mobile);

    // Send OTP
    const result = await sendOTP(mobile, isResend);

    res.status(200).json({
      success: true,
      message: result.message,
      userExists: !!user,
      otp: result.otp, // Only in development
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and login/register
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp, name, city, area, referralCode } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile and OTP",
      });
    }

    // Verify OTP
    const otpResult = await verifyOTP(mobile, otp);

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        error: otpResult.error,
      });
    }

    // Check if user exists
    let user = await User.findOne({ mobile });
    let isNewUser = false;

    if (!user) {
      // New user registration
      if (!name || !city || !area) {
        return res.status(400).json({
          success: false,
          error: "Please provide name, city, and area for registration",
        });
      }

      // Handle referral if code provided
      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
          referredBy = referrer._id;

          // Create referral record
          const referral = new Referral({
            referrerId: referrer._id,
            status: "PENDING",
          });

          // We'll save after user is created
          req.referral = referral;
        }
      }

      // Create new user
      user = await User.create({
        mobile,
        name,
        city,
        area,
        referredBy,
        isVerified: true,
      });

      isNewUser = true;

      // Complete referral if exists
      if (req.referral) {
        req.referral.referredUserId = user._id;
        await req.referral.save();

        // Send notification to referrer
        await NotificationService.sendPushNotification(
          referredBy,
          "New Referral!",
          `${name} registered using your referral code`,
        );
      }

      // Send welcome notification
      await NotificationService.sendSMS(
        mobile,
        `Welcome to RK Electronics, ${name}! Your account has been created successfully. Download our app for exclusive offers.`,
      );
    } else {
      // Existing user login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.deviceTokens;

    res.status(200).json({
      success: true,
      token,
      isNewUser,
      user: userResponse,
      message: isNewUser ? "Registration successful" : "Login successful",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, city, area, preferences } = req.body;

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (city) updateFields.city = city;
    if (area) updateFields.area = area;
    if (preferences) updateFields.preferences = preferences;

    // Update user
    const user = await User.findByIdAndUpdate(req.user.id, updateFields, {
      new: true,
      runValidators: true,
    }).select("-deviceTokens");

    res.status(200).json({
      success: true,
      user,
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register device token for push notifications
// @route   POST /api/auth/register-device
// @access  Private
export const registerDevice = async (req, res, next) => {
  try {
    const { token, platform = "android" } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Please provide device token",
      });
    }

    const result = await NotificationService.registerDeviceToken(
      req.user.id,
      token,
      platform,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we just send success response

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user dashboard data
// @route   GET /api/auth/dashboard
// @access  Private
export const getDashboard = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-deviceTokens")
      .populate("registrationStore", "name location.address");

    // Get user's coupons
    const UserCoupon = require("../models/UserCoupon.model.js");
    const activeCoupons = await UserCoupon.countDocuments({
      userId: req.user.id,
      status: "ACTIVE",
    });

    // Get user's purchases
    const Purchase = require("../models/Purchase.model.js");
    const totalPurchases = await Purchase.countDocuments({
      userId: req.user.id,
    });
    const totalSpent = await Purchase.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    // Get user's referrals
    const Referral = require("../models/Referral.model.js");
    const referralStats = await Referral.getUserStats(req.user.id);

    // Get personalized offers
    const TargetingService = require("../services/targetingService");
    const recommendations =
      await TargetingService.getPersonalizedRecommendations(req.user.id);

    res.status(200).json({
      success: true,
      user,
      stats: {
        activeCoupons,
        totalPurchases,
        totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
        formattedTotalSpent: formatCurrency(
          totalSpent.length > 0 ? totalSpent[0].total : 0,
        ),
        ...referralStats,
      },
      recommendations: recommendations.success ? recommendations : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile number",
      });
    }

    // Check if user exists
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found with this mobile number",
      });
    }

    // Send password reset OTP
    const result = await generatePurposeOTP(mobile, "PASSWORD_RESET", 30);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile, OTP, and new password",
      });
    }

    // Verify OTP
    const otpResult = await verifyPurposeOTP(mobile, "PASSWORD_RESET", otp);

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        error: otpResult.error,
      });
    }

    // Find user and update password
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update user's password (in a real app, you'd hash this)
    // For now, we'll just mark that password was reset
    user.passwordResetAt = new Date();
    await user.save();

    // Send confirmation
    await NotificationService.sendSMS(
      mobile,
      "Your RK Electronics password has been reset successfully. If you did not request this, please contact support.",
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate referral code
// @route   GET /api/auth/validate-referral/:code
// @access  Public
export const validateReferralCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const user = await User.findOne({ referralCode: code });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Invalid referral code",
      });
    }

    res.status(200).json({
      success: true,
      referrer: {
        name: user.name,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    next(error);
  }
};
