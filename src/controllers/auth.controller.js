import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import CityArea from "../models/CityArea.model.js";
import { sendDualOTP, verifyOTP } from "../services/otp.service.js";
import logger from "../utils/logger.js";
import { generateToken, generateRefreshToken } from "../utils/token.js";
import {
  validateSignupInput,
  validateOTPVerifyInput,
  validateSigninInput,
  validateResetPasswordInput,
} from "../utils/validators.js";
import { sendWelcomeEmail } from "../services/email.service.js";

/* ---------------- HELPERS ---------------- */
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const maskEmail = (e) => e.split("@")[0] + "@***";
const maskMobile = (m) => `${m.slice(0, 3)}***${m.slice(-3)}`;

// FCM Registration Helper - WITHOUT TRANSACTIONS

const registerOrUpdateFCMToken = async (
  userId,
  deviceToken,
  platform = "android",
  deviceId = null,
) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Clean expired/invalid tokens (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    user.deviceTokens = user.deviceTokens.filter(
      (dt) => dt.lastUsed > thirtyDaysAgo,
    );

    // Check if token already exists
    const existingTokenIndex = user.deviceTokens.findIndex(
      (dt) =>
        dt.token === deviceToken || (deviceId && dt.deviceId === deviceId),
    );

    if (existingTokenIndex >= 0) {
      // Update existing token
      user.deviceTokens[existingTokenIndex].token = deviceToken;
      user.deviceTokens[existingTokenIndex].platform = platform;
      user.deviceTokens[existingTokenIndex].lastUsed = new Date();
      if (deviceId) {
        user.deviceTokens[existingTokenIndex].deviceId = deviceId;
      }
    } else {
      // Limit total devices to 5 (remove oldest)
      if (user.deviceTokens.length >= 5) {
        user.deviceTokens.sort((a, b) => a.lastUsed - b.lastUsed);
        user.deviceTokens.shift();
      }

      user.deviceTokens.push({
        token: deviceToken,
        platform,
        deviceId,
        lastUsed: new Date(),
      });
    }

    await user.save();
    logger.info(`FCM token registered/updated for user ${userId}`);
    return true;
  } catch (error) {
    logger.error("Error registering FCM token:", error);
    return false;
  }
};

/* =====================================================
   SIGNUP → SEND OTP
===================================================== */

export const signupSendOTP1 = async (req, res) => {
  try {
    validateSignupInput(req.body);

    const {
      name,
      email,
      mobile,
      password,
      city_id,
      area_id,
      referralCode,
      deviceToken, // FCM Token from frontend
      platform = "android",
      deviceId, // Unique device identifier
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { mobile }],
    });
    if (existingUser) return fail(res, 409, "User already exists");

    // Location validation
    const isValidLocation = await CityArea.isValidCityArea(city_id, area_id);
    if (!isValidLocation) return fail(res, 400, "Invalid city or area");
    const location = await CityArea.getCityWithArea(city_id, area_id);

    // Referral
    let referredBy = null;
    if (referralCode) {
      referredBy = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (!referredBy) return fail(res, 400, "Invalid referral code");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const tempUser = {
      name: name.trim(),
      email: email.toLowerCase(),
      mobile,
      password: hashedPassword,
      city: city_id,
      area: area_id,
      cityName: location.city.name,
      areaName: location.area.name,
      referredBy: referredBy?._id,
      // Store FCM info for later use in verify
      deviceToken,
      platform,
      deviceId,
    };

    const tempToken = jwt.sign(
      { tempUser, purpose: "SIGNUP" },
      process.env.JWT_TEMP_SECRET,
      { expiresIn: "15m" },
    );

    // Send OTP - FIXED EMAIL DOMAIN
    await sendDualOTP({
      email: tempUser.email,
      mobile: tempUser.mobile,
      purpose: "SIGNUP",
    });

    return res.json({
      success: true,
      message: "OTP sent to email and mobile",
      tempToken,
      expiresIn: 900,
    });
  } catch (error) {
    logger.error("Error in SignUp Send OTP:", error);
    return fail(res, 400, error.message);
  }
};

export const signupSendOTP = async (req, res) => {
  try {
    // Validate input with detailed errors
    try {
      validateSignupInput(req.body);
    } catch (validationError) {
      // Check if it's a structured error object
      if (validationError.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationError.errors,
        });
      }
      // Regular error string
      return fail(res, 400, validationError.message);
    }

    const {
      name,
      email,
      mobile,
      password,
      city_id,
      area_id,
      referralCode,
      deviceToken,
      platform = "android",
      deviceId,
    } = req.body;

    // Clean inputs
    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile.trim(); // mobile is now required

    // Check if user exists - mobile is now required, so check both
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { mobile: cleanMobile }],
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return fail(res, 409, "Email already registered");
      }
      if (existingUser.mobile === cleanMobile) {
        return fail(res, 409, "Mobile number already registered");
      }
    }

    // Location validation
    const isValidLocation = await CityArea.isValidCityArea(city_id, area_id);
    if (!isValidLocation) return fail(res, 400, "Invalid city or area");
    const location = await CityArea.getCityWithArea(city_id, area_id);

    // Referral
    let referredBy = null;
    if (referralCode && referralCode.trim() !== "") {
      const cleanReferralCode = referralCode.trim().toUpperCase();
      referredBy = await User.findOne({
        referralCode: cleanReferralCode,
      });
      if (!referredBy) return fail(res, 400, "Invalid referral code");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const tempUser = {
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile, // Now guaranteed to exist
      password: hashedPassword,
      city: city_id,
      area: area_id,
      cityName: location.city.name,
      areaName: location.area.name,
      referredBy: referredBy?._id,
      deviceToken,
      platform,
      deviceId,
    };

    const tempToken = jwt.sign(
      { tempUser, purpose: "SIGNUP" },
      process.env.JWT_TEMP_SECRET,
      { expiresIn: "15m" },
    );

    // Send OTP to both email and mobile (mobile is now required)
    await sendDualOTP({
      email: tempUser.email,
      mobile: tempUser.mobile,
      purpose: "SIGNUP",
    });

    return res.json({
      success: true,
      message: "OTP sent to email and mobile",
      tempToken,
      expiresIn: 900,
    });
  } catch (error) {
    logger.error("Error in SignUp Send OTP:", error);
    return fail(res, 400, error.message);
  }
};

/* =====================================================
   SIGNUP → VERIFY OTP (WITH FCM REGISTRATION) - WITHOUT TRANSACTION
===================================================== */

export const signupVerifyOTP = async (req, res) => {
  try {
    const {
      otp,
      tempToken,
      deviceToken,
      platform = "android",
      deviceId,
    } = req.body;

    const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);
    if (decoded.purpose !== "SIGNUP") return fail(res, 401, "Invalid token");

    const { tempUser } = decoded;

    console.log("tempUser in singnUpVerifyOTP ", tempUser);
    // Verify OTP - FIXED: Use exact identifier from signup
    await verifyOTP({
      identifier: tempUser.email.toLowerCase(), // Use the email from tempUser (should match exactly)
      type: "email",
      otp,
      purpose: "SIGNUP",
    });

    // Create user WITHOUT transaction
    const user = new User({
      name: tempUser.name,
      email: tempUser.email,
      mobile: tempUser.mobile,
      password: tempUser.password,
      city: tempUser.city,
      area: tempUser.area,
      cityName: tempUser.cityName,
      areaName: tempUser.areaName,
      referredBy: tempUser.referredBy,
      isVerified: true,
      lastLogin: new Date(),
    });

    console.log("user in singnUpVerifyOTP ", user);

    await user.save();

    // Register FCM token (use deviceToken from request if provided, otherwise from tempUser)
    const fcmTokenToRegister = deviceToken || tempUser.deviceToken;
    if (fcmTokenToRegister) {
      await registerOrUpdateFCMToken(
        user._id,
        fcmTokenToRegister,
        platform || tempUser.platform,
        deviceId || tempUser.deviceId,
      );
    }

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(user).catch((err) =>
      logger.error("Welcome email failed:", err),
    );

    // Generate tokens
    const authToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token: authToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        cityName: user.cityName,
        areaName: user.areaName,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    logger.error("Verify signup OTP error:", error);

    // Provide more specific error messages
    if (error.message.includes("OTP expired")) {
      return fail(res, 400, "OTP has expired. Please request a new one.");
    }
    if (error.message.includes("not found")) {
      return fail(res, 400, "Invalid OTP. Please check and try again.");
    }

    return fail(res, 400, error.message);
  }
};

// export const signupVerifyOTP2 = async (req, res) => {
//   try {
//     const {
//       otp,
//       tempToken,
//       deviceToken,
//       platform = "android",
//       deviceId,
//     } = req.body;

//     const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);
//     if (decoded.purpose !== "SIGNUP") return fail(res, 401, "Invalid token");

//     const { tempUser } = decoded;

//     // Verify OTP
//     await verifyOTP({
//       identifier: tempUser.email.toLowerCase(),
//       type: "email",
//       otp,
//       purpose: "SIGNUP",
//     });

//     // Create user - handle mobile being null or empty
//     const userData = {
//       name: tempUser.name,
//       email: tempUser.email.toLowerCase(),
//       password: tempUser.password,
//       city: tempUser.city,
//       area: tempUser.area,
//       cityName: tempUser.cityName,
//       areaName: tempUser.areaName,
//       referredBy: tempUser.referredBy,
//       isVerified: true,
//       lastLogin: new Date(),
//     };

//     // Only add mobile if it exists and is not null/empty
//     if (tempUser.mobile && tempUser.mobile.trim() !== "") {
//       userData.mobile = tempUser.mobile.trim();
//     }

//     const user = new User(userData);
//     await user.save();

//     // ... rest of the code ...
//   } catch (error) {
//     // ... error handling ...
//   }
// };

/* =====================================================
   SIGNIN → SEND OTP
===================================================== */

export const signinSendOTP = async (req, res) => {
  try {
    console.log("Signin Send OTP hit");
    const { emailOrMobile } = req.body;

    console.log("Received:", emailOrMobile);

    // Find user by email OR mobile (case-insensitive for email)
    const user = await User.findOne({
      $or: [
        { email: emailOrMobile.toLowerCase().trim() },
        { mobile: emailOrMobile.trim() },
      ],
    }).lean(); // Use lean to get a plain object

    console.log("User found in SignIn (lean):", user);

    if (!user) {
      console.log("User not found for:", emailOrMobile);
      return fail(res, 404, "User not found");
    }

    // Check account status with better error messages
    if (!user.isActive) {
      console.log("Account not active for user:", user._id);
      return fail(
        res,
        403,
        "Your account is deactivated. Please contact support.",
      );
    }

    if (user.isBlocked) {
      console.log("Account blocked for user:", user._id);
      return fail(
        res,
        403,
        "Your account is blocked. Please contact administrator.",
      );
    }

    // Check if user is verified
    if (!user.isVerified) {
      console.log("Account not verified for user:", user._id);
      return fail(res, 403, "Please verify your account first.");
    }

    console.log("Sending OTP to:", {
      email: user.email,
      mobile: user.mobile,
    });

    // Send OTP
    await sendDualOTP({
      email: user.email,
      mobile: user.mobile,
      purpose: "LOGIN",
    });

    // Create temp token
    const tempToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        mobile: user.mobile,
        purpose: "LOGIN",
      },
      process.env.JWT_TEMP_SECRET,
      { expiresIn: "10m" },
    );

    console.log("OTP sent successfully to user:", user._id);

    return res.json({
      success: true,
      message: "OTP sent to your registered email and mobile",
      tempToken,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    console.error("Signin send OTP error:", error);
    logger.error("Signin send OTP error:", error);
    return fail(res, 500, "Failed to send OTP. Please try again.");
  }
};

/* =====================================================
   SIGNIN → VERIFY OTP (WITH FCM REGISTRATION)
===================================================== */

export const signinVerifyOTP = async (req, res) => {
  try {
    // console.log("req body in signinVerifyOTP", req.body);

    const {
      otp,
      tempToken,
      deviceToken,
      platform = "android",
      deviceId,
    } = req.body;

    if (!otp || !tempToken) {
      return fail(res, 400, "OTP and Token are required");
    }

    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);

    if (decoded.purpose !== "LOGIN") {
      return fail(res, 401, "Invalid token");
    }

    // console.log("Decoded token:", decoded);

    // Get user - use email from token since it's guaranteed to exist
    const user = await User.findById(decoded.userId);

    if (!user) {
      console.log("User not found for ID:", decoded.userId);
      return fail(res, 404, "User not found");
    }

    // console.log("User found for verification:", {
    //   id: user._id,
    //   email: user.email,
    //   mobile: user.mobile,
    //   isActive: user.isActive,
    //   isBlocked: user.isBlocked,
    // });

    // Use email from token or user document (prefer token)
    const identifier = decoded.email || user.email;

    if (!identifier) {
      console.error("No email identifier found for user:", user._id);
      return fail(res, 400, "Unable to verify OTP. Please try again.");
    }

    console.log("Verifying OTP for identifier:", identifier);

    // Verify OTP
    await verifyOTP({
      identifier: identifier, // Use the guaranteed identifier
      type: "email",
      otp,
      purpose: "LOGIN",
    });

    // Update user
    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save();

    // Register FCM token if provided
    if (deviceToken) {
      try {
        await registerOrUpdateFCMToken(
          user._id,
          deviceToken,
          platform,
          deviceId,
        );
        console.log("FCM token registered for user:", user._id);
      } catch (fcmError) {
        console.error("FCM registration error:", fcmError);
        // Don't fail auth if FCM registration fails
      }
    }

    // Generate tokens
    const authToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log("Login successful for user:", user._id);

    return res.json({
      success: true,
      message: "Login successful",
      token: authToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        cityName: user.cityName,
        areaName: user.areaName,

        userType: user.userType,
        walletBalance: user.walletBalance,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error("Signin verify OTP error:", error);

    // Provide specific error messages
    if (error.name === "TokenExpiredError") {
      return fail(res, 401, "OTP token has expired. Please request a new OTP.");
    }

    if (error.name === "JsonWebTokenError") {
      return fail(res, 401, "Invalid OTP token. Please try again.");
    }

    if (error.message.includes("OTP expired")) {
      return fail(res, 400, "OTP has expired. Please request a new one.");
    }

    if (error.message.includes("not found")) {
      return fail(res, 400, "Invalid OTP. Please check and try again.");
    }

    return fail(res, 400, error.message || "Failed to verify OTP");
  }
};

/* =====================================================
   REGISTER/UPDATE FCM TOKEN (STANDALONE ENDPOINT)
===================================================== */

export const registerFCMToken = async (req, res) => {
  try {
    const { deviceToken, platform = "android", deviceId } = req.body;

    if (!deviceToken) {
      return fail(res, 400, "Device token is required");
    }

    await registerOrUpdateFCMToken(
      req.user._id,
      deviceToken,
      platform,
      deviceId,
    );

    return res.json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (error) {
    logger.error("FCM registration error:", error);
    return fail(res, 500, "Failed to register device token");
  }
};

/* =====================================================
   LOGOUT WITH FCM CLEANUP
===================================================== */

export const logout = async (req, res) => {
  try {
    console.log("logout hitt");
    const userId = req.user._id;
    const { deviceToken, deviceId } = req.body; // Optional: specific device to logout

    const user = await User.findById(userId);
    if (!user) return fail(res, 404, "User not found");

    // Remove specific device token if provided
    if (deviceToken || deviceId) {
      user.deviceTokens = user.deviceTokens.filter(
        (dt) => dt.token !== deviceToken && dt.deviceId !== deviceId,
      );
    } else {
      // Clear all tokens (full logout from all devices)
      user.deviceTokens = [];
    }

    await user.save();

    logger.info(
      `User ${userId} logged out${deviceToken ? " from specific device" : " from all devices"}`,
    );

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    return fail(res, 500, "Logout failed");
  }
};

/* =====================================================
   GET LOGIN STATUS WITH DEVICE INFO
===================================================== */

export const getLoginStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "_id name email mobile isActive isVerified lastLogin userType walletBalance deviceTokens",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      isLoggedIn: true,
      user: {
        ...user.toObject(),
        // Don't send device tokens to frontend for security
        deviceTokens: undefined,
      },
      deviceCount: user.deviceTokens.length,
      lastActive: user.lastUsed,
    });
  } catch (error) {
    logger.error("Login status check error:", error);
    return res.status(500).json({
      success: false,
      message: "Status check failed",
    });
  }
};

/* =====================================================
   GET USER PROFILE
===================================================== */

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select(
        "-password -__v -deviceTokens -passwordResetToken -passwordResetExpires",
      )
      .populate("city", "name")
      .populate("area", "name");

    if (!user) return fail(res, 404, "User not found");

    return res.json({
      success: true,
      user: {
        ...user.toObject(),
        // Add computed fields
        maskedEmail: user.maskedEmail,
        maskedMobile: user.maskedMobile,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    logger.error("Get profile error:", error);
    return fail(res, 500, "Failed to fetch profile");
  }
};

/* =====================================================
   REFRESH TOKEN ENDPOINT
===================================================== */

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return fail(res, 400, "Refresh token is required");
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) return fail(res, 404, "User not found");

    if (!user.isActive || user.isBlocked) {
      return fail(res, 403, "Account is disabled");
    }

    // Generate new tokens
    const newAccessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    return res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    });
  } catch (error) {
    logger.error("Token refresh error:", error);

    if (error.name === "TokenExpiredError") {
      return fail(res, 401, "Refresh token expired");
    }

    return fail(res, 401, "Invalid refresh token");
  }
};

// Additional endpoints from your code...
export const validateReferralCode = async (req, res) => {
  try {
    const referralUser = await User.findOne({
      referralCode: req.params.code.toUpperCase(),
      isActive: true,
    }).select("name");

    if (!referralUser)
      return res.status(404).json({ success: false, message: "Invalid code" });
    return res
      .status(200)
      .json({ success: true, referrerName: referralUser.name });
  } catch (error) {
    res.status(500).json({ success: false, message: "Validation failed" });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email mobile walletBalance userType referralCode",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      dashboard: {
        user,
        stats: {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          walletBalance: user.walletBalance,
          referralCount: 0,
        },
        quickActions: [
          { id: 1, title: "Place Order", icon: "shopping-cart" },
          { id: 2, title: "Track Order", icon: "map" },
          { id: 3, title: "My Wallet", icon: "wallet" },
          { id: 4, title: "Refer & Earn", icon: "users" },
        ],
      },
    });
  } catch (error) {
    logger.error("Get dashboard error", {
      userId: req.user?._id,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    const user = await User.findOne({
      $or: [{ email: emailOrMobile.toLowerCase() }, { mobile: emailOrMobile }],
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If account exists, OTP sent",
      });
    }

    await sendDualOTP({
      email: user.email,
      mobile: user.mobile,
      purpose: "PASSWORD_RESET",
    });

    const resetToken = jwt.sign(
      { userId: user._id, purpose: "PASSWORD_RESET" },
      process.env.JWT_RESET_SECRET,
      { expiresIn: "10m" },
    );

    return res.json({ success: true, resetToken, expiresIn: 600 });
  } catch (error) {
    return fail(res, 400, error.message);
  }
};

export const resetPassword = async (req, res) => {
  try {
    validateResetPasswordInput(req.body);

    const { resetToken, otp, newPassword } = req.body;

    const decoded = jwt.verify(resetToken, process.env.JWT_RESET_SECRET);

    if (decoded.purpose !== "PASSWORD_RESET") {
      return fail(res, 401, "Invalid reset token");
    }

    const user = await User.findById(decoded.userId);
    if (!user) return fail(res, 404, "User not found");

    await verifyOTP({
      identifier: user.email,
      type: "email",
      otp: otp,
      purpose: "PASSWORD_RESET",
    });

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return res.json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    logger.error("Reset password error", error);
    return fail(res, 400, error.message);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = ["name", "profileImage", "preferences"];
    const updateData = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) updateData[key] = req.body[key];
    });

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid updates" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password -__v -deviceTokens");

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Update failed" });
  }
};
