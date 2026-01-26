import Staff from "../models/Staff.model.js";
import NotificationService from "../services/notificationService.js";
import Referral from "../models/Referral.model.js";
import { generateToken } from "../middleware/auth.js";
import { formatCurrency } from "../utils/common.js";
import {
  generatePurposeOTP,
  verifyPurposeOTP,
  checkOTPExists,
} from "../services/otpService.js";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

// ================================
// Send OTP to mobile
// ================================
export const sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile)
      return res
        .status(400)
        .json({ success: false, error: "Please provide mobile number" });

    const user = await Staff.findOne({ mobile });
    const isResend = await checkOTPExists(mobile);

    const result = await generatePurposeOTP(mobile, "LOGIN", 5); // Using generic login OTP
    res.status(200).json({
      success: true,
      message: result.message,
      userExists: !!user,
      otp: result.otp, // only for dev/debug
    });
  } catch (error) {
    next(error);
  }
};

// ================================
// Verify OTP and login/register
// ================================
export const verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp, name, city, area, referralCode } = req.body;
    if (!mobile || !otp)
      return res
        .status(400)
        .json({ success: false, error: "Please provide mobile and OTP" });

    const otpResult = await verifyPurposeOTP(mobile, "LOGIN", otp);
    if (!otpResult.success)
      return res.status(400).json({ success: false, error: otpResult.error });

    let user = await Staff.findOne({ mobile });
    let isNewUser = false;

    if (!user) {
      if (!name || !city || !area)
        return res.status(400).json({
          success: false,
          error: "Please provide name, city, and area for registration",
        });

      let referredBy = null;
      if (referralCode) {
        const referrer = await Staff.findOne({ referralCode });
        if (referrer) referredBy = referrer._id;
      }

      user = await Staff.create({
        mobile,
        name,
        city,
        area,
        referredBy,
        isVerified: true,
      });
      isNewUser = true;

      if (referredBy) {
        await NotificationService.sendPushNotification(
          referredBy,
          "New Referral!",
          `${name} registered using your referral code`,
        );
      }

      await NotificationService.sendSMS(
        mobile,
        `Welcome! Your account has been created successfully.`,
      );
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    const token = generateToken(user._id);
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

// ================================
// Staff Profile
// ================================
export const getProfile = async (req, res) => {
  try {
    const user = await Staff.findById(req.user.id).select(
      "-password -deviceTokens",
    );
    if (!user) return res.status(404).json({ message: "Staff not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updates = {};
    ["name", "email", "city", "area", "preferences"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updated = await Staff.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-deviceTokens");
    res.status(200).json({
      success: true,
      user: updated,
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================================
// Staff Password Management
// ================================
export const forgotPassword = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile)
      return res
        .status(400)
        .json({ success: false, error: "Please provide mobile number" });

    const user = await Staff.findOne({ mobile });
    if (!user)
      return res.status(404).json({ success: false, error: "Staff not found" });

    const result = await generatePurposeOTP(mobile, "PASSWORD_RESET", 30);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, newPassword } = req.body;
    if (!mobile || !otp || !newPassword)
      return res.status(400).json({
        success: false,
        error: "Please provide mobile, OTP, and new password",
      });

    const otpResult = await verifyPurposeOTP(mobile, "PASSWORD_RESET", otp);
    if (!otpResult.success)
      return res.status(400).json({ success: false, error: otpResult.error });

    const user = await Staff.findOne({ mobile });
    if (!user)
      return res.status(404).json({ success: false, error: "Staff not found" });

    user.password = newPassword;
    user.passwordResetAt = new Date();
    await user.save();

    await NotificationService.sendSMS(
      mobile,
      "Your password has been reset successfully.",
    );

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

// ================================
// Staff Device Management
// ================================
export const registerDevice = async (req, res, next) => {
  try {
    const { token, platform = "android" } = req.body;
    if (!token)
      return res
        .status(400)
        .json({ success: false, error: "Please provide device token" });

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

export const logout = async (req, res) => {
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ================================
// Login Status Check
// ================================
export const getLoginStatus = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.json(false);

  const token = authHeader.split(" ")[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    res.json(!!verified);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================
// Dashboard (Staff)
export const getDashboard = async (req, res) => {
  try {
    const user = await Staff.findById(req.user.id).select("-deviceTokens");
    res
      .status(200)
      .json({ success: true, user, message: "Dashboard data placeholder" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
// ================================
// Admin: Manage Staff Members
// ================================
export const createStaff = async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, role, area } =
      req.body;

    const existing = await Staff.findOne({ $or: [{ email }, { phone }] });
    if (existing)
      return res.status(400).json({ message: "Staff already exists" });

    const staff = await Staff.create({
      firstName,
      lastName,
      phone,
      email,
      password,
      role,
      area,
    });
    res.status(201).json({ message: "Staff created successfully", staff });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllStaff = async (req, res) => {
  try {
    const staffList = await Staff.find().select("-password -deviceTokens");
    res.status(200).json(staffList);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).select(
      "-password -deviceTokens",
    );
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const updates = {};
    ["firstName", "lastName", "phone", "email", "role", "area"].forEach(
      (key) => {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      },
    );

    const updated = await Staff.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!updated) return res.status(404).json({ message: "Staff not found" });

    res
      .status(200)
      .json({ message: "Staff updated successfully", staff: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Staff not found" });

    res.status(200).json({ message: "Staff deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
