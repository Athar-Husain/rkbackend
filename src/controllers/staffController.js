import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Staff from "../models/Staff.model.js";
import { sendDualOTP, verifyOTP } from "../services/otp.service.js";
import logger from "../utils/logger.js";
import { generateToken, generateRefreshToken } from "../utils/token.js";
import { validateResetPasswordInput } from "../utils/validators.js";
// import { ConfigurationServicePlaceholders } from "aws-sdk/lib/config_service_placeholders.js";

/* ---------------- HELPERS ---------------- */
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const maskEmail = (e) => e.split("@")[0] + "@***";
const maskMobile = (m) => `${m.slice(0, 3)}***${m.slice(-3)}`;

// FCM Registration Helper
const registerOrUpdateFCMToken = async (
  staffId,
  deviceToken,
  platform = "android",
  deviceId = null,
) => {
  try {
    const staff = await Staff.findById(staffId);
    if (!staff) return;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    staff.deviceTokens = staff.deviceTokens.filter(
      (dt) => dt.lastUsed > thirtyDaysAgo,
    );

    const existingTokenIndex = staff.deviceTokens.findIndex(
      (dt) =>
        dt.token === deviceToken || (deviceId && dt.deviceId === deviceId),
    );

    if (existingTokenIndex >= 0) {
      staff.deviceTokens[existingTokenIndex].token = deviceToken;
      staff.deviceTokens[existingTokenIndex].platform = platform;
      staff.deviceTokens[existingTokenIndex].lastUsed = new Date();
      if (deviceId) staff.deviceTokens[existingTokenIndex].deviceId = deviceId;
    } else {
      if (staff.deviceTokens.length >= 5) {
        staff.deviceTokens.sort((a, b) => a.lastUsed - b.lastUsed);
        staff.deviceTokens.shift();
      }
      staff.deviceTokens.push({
        token: deviceToken,
        platform,
        deviceId,
        lastUsed: new Date(),
      });
    }

    await staff.save();
    logger.info(`FCM token registered/updated for staff ${staffId}`);
    return true;
  } catch (error) {
    logger.error("Error registering FCM token:", error);
    return false;
  }
};

/* =====================================================
   ADMIN → CREATE STAFF (NO OTP)
===================================================== */
export const createStaff1 = async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || !email || !mobile || !password) {
      return fail(res, 400, "All fields are required");
    }

    const existingStaff = await Staff.findOne({
      $or: [{ email: email.toLowerCase() }, { mobile }],
    });

    if (existingStaff) {
      return fail(res, 409, "Staff with same email or mobile already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const staff = new Staff({
      name: name.trim(),
      email: email.toLowerCase(),
      mobile: mobile.trim(),
      password: hashedPassword,
      role: role || "staff",
      isActive: true,
      isVerified: true, // auto-verified by admin
      lastLogin: new Date(),
    });

    await staff.save();

    return res.status(201).json({
      success: true,
      message: "Staff created successfully",
      user: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        mobile: staff.mobile,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    logger.error("Create staff error:", error);
    return fail(res, 500, "Failed to create staff");
  }
};

export const createStaff2 = async (req, res) => {
  try {
    const { storeId, name, username, password, role, permissions } = req.body;

    if (!storeId || !name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const existingStaff = await Staff.findOne({
      username: username.toLowerCase().trim(),
    });
    if (existingStaff) {
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }

    const staff = new Staff({
      storeId,
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password, // hashed automatically in pre-save hook
      role: role?.toLowerCase() || "staff",
      permissions: permissions || undefined, // defaults applied by schema
      isActive: true,
    });

    await staff.save();

    return res.status(201).json({
      success: true,
      message: "Staff created successfully",
      user: {
        id: staff._id,
        storeId: staff.storeId,
        name: staff.name,
        username: staff.username,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("Create staff error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create staff" });
  }
};

// CREATE STAFF
export const createStaff = async (req, res) => {
  try {
    const {
      storeId,
      name,
      email,
      mobile,
      username,
      password,
      role,
      permissions,
      isActive,
    } = req.body;

    console.log("req.body", req.body);

    // Validate required fields
    if (!storeId || !name || !username || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Check for duplicate username, email, or mobile
    const existingStaff = await Staff.findOne({
      $or: [
        { username: username.toLowerCase().trim() },
        { email: email?.toLowerCase().trim() },
        { mobile: mobile.trim() },
      ],
    });
    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: "Username, Email or Mobile already exists",
      });
    }

    const staff = new Staff({
      storeId,
      name: name.trim(),
      email: email?.toLowerCase().trim(),
      mobile: mobile.trim(),
      username: username.toLowerCase().trim(),
      password, // hashed automatically in pre-save hook
      role: role?.toLowerCase() || "staff",
      permissions: permissions || undefined,
      isActive: isActive ?? true,
    });

    await staff.save();

    return res.status(201).json({
      success: true,
      message: "Staff created successfully",
      user: {
        id: staff._id,
        storeId: staff.storeId,
        name: staff.name,
        email: staff.email,
        mobile: staff.mobile,
        username: staff.username,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("Create staff error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create staff" });
  }
};

// UPDATE STAFF
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      mobile,
      username,
      password,
      role,
      permissions,
      isActive,
      storeId,
    } = req.body;

    const staff = await Staff.findById(id);
    if (!staff)
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });

    // Check duplicates if changed
    if (username && username.toLowerCase().trim() !== staff.username) {
      const exists = await Staff.findOne({
        username: username.toLowerCase().trim(),
      });
      if (exists)
        return res
          .status(409)
          .json({ success: false, message: "Username already exists" });
    }
    if (email && email.toLowerCase().trim() !== staff.email) {
      const exists = await Staff.findOne({ email: email.toLowerCase().trim() });
      if (exists)
        return res
          .status(409)
          .json({ success: false, message: "Email already exists" });
    }
    if (mobile && mobile.trim() !== staff.mobile) {
      const exists = await Staff.findOne({ mobile: mobile.trim() });
      if (exists)
        return res
          .status(409)
          .json({ success: false, message: "Mobile already exists" });
    }

    // Update fields
    staff.storeId = storeId ?? staff.storeId;
    staff.name = name ?? staff.name;
    staff.email = email?.toLowerCase().trim() ?? staff.email;
    staff.mobile = mobile?.trim() ?? staff.mobile;
    staff.username = username?.toLowerCase().trim() ?? staff.username;
    staff.role = role?.toLowerCase() ?? staff.role;
    staff.permissions = permissions ?? staff.permissions;
    staff.isActive = isActive ?? staff.isActive;
    if (password) staff.password = password;

    await staff.save();

    return res
      .status(200)
      .json({ success: true, message: "Staff updated successfully", staff });
  } catch (error) {
    console.error("Update staff error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update staff" });
  }
};

/* =====================================================
   STAFF LOGIN → SEND OTP
===================================================== */
export const staffSigninSendOTP = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;
    const staff = await Staff.findOne({
      $or: [
        { email: emailOrMobile.toLowerCase().trim() },
        { mobile: emailOrMobile.trim() },
      ],
    }).lean();

    if (!staff) return fail(res, 404, "Staff not found");
    if (!staff.isActive) return fail(res, 403, "Account deactivated");
    // if (!staff.isVerified) return fail(res, 403, "Staff not verified");

    await sendDualOTP({
      email: staff.email,
      mobile: staff.mobile,
      purpose: "LOGIN",
    });

    const tempToken = jwt.sign(
      {
        staffId: staff._id,
        email: staff.email,
        mobile: staff.mobile,
        purpose: "LOGIN",
      },
      process.env.JWT_TEMP_SECRET,
      { expiresIn: "10m" },
    );

    return res.json({
      success: true,
      message: "OTP sent",
      tempToken,
      expiresIn: 600,
    });
  } catch (error) {
    logger.error("Staff signin send OTP error:", error);
    return fail(res, 500, "Failed to send OTP");
  }
};

/* =====================================================
   STAFF LOGIN → VERIFY OTP
===================================================== */
export const staffSigninVerifyOTP = async (req, res) => {
  try {
    const {
      otp,
      tempToken,
      deviceToken,
      platform = "android",
      deviceId,
    } = req.body;
    if (!otp || !tempToken) return fail(res, 400, "OTP and token are required");

    const decoded = jwt.verify(tempToken, process.env.JWT_TEMP_SECRET);
    if (decoded.purpose !== "LOGIN") return fail(res, 401, "Invalid token");

    const staff = await Staff.findById(decoded.staffId);
    if (!staff) return fail(res, 404, "Staff not found");

    await verifyOTP({
      identifier: decoded.email,
      type: "email",
      otp,
      purpose: "LOGIN",
    });

    staff.lastLogin = new Date();
    staff.lastActive = new Date();
    await staff.save();

    if (deviceToken) {
      await registerOrUpdateFCMToken(
        staff._id,
        deviceToken,
        platform,
        deviceId,
      );
    }

    const authToken = generateToken(staff._id);
    const refreshToken = generateRefreshToken(staff._id);

    return res.json({
      success: true,
      message: "Login successful",
      token: authToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        mobile: staff.mobile,
        userType: staff.userType,
        role: staff.role,
      },
    });
  } catch (error) {
    logger.error("Staff signin verify OTP error:", error);
    if (error.name === "TokenExpiredError")
      return fail(res, 401, "OTP token expired");
    if (error.name === "JsonWebTokenError")
      return fail(res, 401, "Invalid OTP token");
    return fail(res, 400, error.message || "Failed to verify OTP");
  }
};

/* =====================================================
   STAFF FCM TOKEN
===================================================== */
export const registerStaffFCMToken = async (req, res) => {
  try {
    const { deviceToken, platform = "android", deviceId } = req.body;
    if (!deviceToken) return fail(res, 400, "Device token required");

    await registerOrUpdateFCMToken(
      req.user._id,
      // req.staff._id,
      deviceToken,
      platform,
      deviceId,
    );

    return res.json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (error) {
    logger.error("Register staff FCM error:", error);
    return fail(res, 500, "Failed to register device token");
  }
};

/* =====================================================
   STAFF LOGOUT
===================================================== */
export const staffLogout = async (req, res) => {
  try {
    const { deviceToken, deviceId } = req.body;
    // const staff = await Staff.findById(req.staff._id);

    // console.log("req. user in staff logout ", req.user)
    const staff = await Staff.findById(req.user._id);
    if (!staff) return fail(res, 404, "Staff not found");

    if (deviceToken || deviceId) {
      staff.deviceTokens = staff.deviceTokens.filter(
        (dt) => dt.token !== deviceToken && dt.deviceId !== deviceId,
      );
    } else {
      staff.deviceTokens = [];
    }

    await staff.save();
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    logger.error("Staff logout error:", error);
    return fail(res, 500, "Logout failed");
  }
};

/* =====================================================
   STAFF PROFILE
===================================================== */
export const getStaffProfile = async (req, res) => {
  try {
    // const staff = await Staff.findById(req.staff._id).select(
    const staff = await Staff.findById(req.user._id).select(
      "-password -__v -deviceTokens",
    );
    if (!staff) return fail(res, 404, "Staff not found");

    return res.json({
      success: true,
      user: {
        ...staff.toObject(),
        maskedEmail: maskEmail(staff.email),
        maskedMobile: maskMobile(staff.mobile),
      },
    });
  } catch (error) {
    logger.error("Get staff profile error:", error);
    return fail(res, 500, "Failed to fetch profile");
  }
};

export const updateStaffProfile = async (req, res) => {
  try {
    const allowedUpdates = ["name", "profileImage", "role"];
    const updateData = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) updateData[key] = req.body[key];
    });

    if (Object.keys(updateData).length === 0)
      return fail(res, 400, "No valid updates");

    const staff = await Staff.findByIdAndUpdate(
      // req.staff._id,
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password -__v -deviceTokens");

    return res.json({ success: true, staff });
  } catch (error) {
    logger.error("Update staff profile error:", error);
    return fail(res, 500, "Update failed");
  }
};

/* =====================================================
   STAFF REFRESH TOKEN
===================================================== */
export const staffRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return fail(res, 400, "Refresh token required");

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const staff = await Staff.findById(decoded.staffId);
    if (!staff) return fail(res, 404, "Staff not found");
    if (!staff.isActive) return fail(res, 403, "Account disabled");

    const newAccessToken = generateToken(staff._id);
    const newRefreshToken = generateRefreshToken(staff._id);

    return res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    });
  } catch (error) {
    logger.error("Staff refresh token error:", error);
    if (error.name === "TokenExpiredError")
      return fail(res, 401, "Refresh token expired");
    return fail(res, 401, "Invalid refresh token");
  }
};

/* =====================================================
   STAFF FORGOT/RESET PASSWORD
===================================================== */
export const staffForgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;
    const staff = await Staff.findOne({
      $or: [{ email: emailOrMobile.toLowerCase() }, { mobile: emailOrMobile }],
    });

    if (!staff)
      return res.json({
        success: true,
        message: "If account exists, OTP sent",
      });

    await sendDualOTP({
      email: staff.email,
      mobile: staff.mobile,
      purpose: "PASSWORD_RESET",
    });

    const resetToken = jwt.sign(
      { staffId: staff._id, purpose: "PASSWORD_RESET" },
      process.env.JWT_RESET_SECRET,
      { expiresIn: "10m" },
    );
    return res.json({ success: true, resetToken, expiresIn: 600 });
  } catch (error) {
    logger.error("Staff forgot password error:", error);
    return fail(res, 400, error.message);
  }
};

export const staffResetPassword = async (req, res) => {
  try {
    validateResetPasswordInput(req.body);
    const { resetToken, otp, newPassword } = req.body;

    const decoded = jwt.verify(resetToken, process.env.JWT_RESET_SECRET);
    if (decoded.purpose !== "PASSWORD_RESET")
      return fail(res, 401, "Invalid reset token");

    const staff = await Staff.findById(decoded.staffId);
    if (!staff) return fail(res, 404, "Staff not found");

    await verifyOTP({
      identifier: staff.email,
      type: "email",
      otp,
      purpose: "PASSWORD_RESET",
    });

    staff.password = newPassword;
    await staff.save();

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    logger.error("Staff reset password error:", error);
    return fail(res, 400, error.message);
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

export const getStaffDashboard = async (req, res) => {
  try {
    const user = await Staff.findById(req.user.id).select("-deviceTokens");
    res
      .status(200)
      .json({ success: true, user, message: "Dashboard data placeholder" });
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

export const getStaffLoginStatus = async (req, res) => {
  try {
    // console.log("req.user", req.staff);

    const user = await Staff.findById(req.user._id).select(
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
      lastActive: user.lastActive,
    });
  } catch (error) {
    logger.error("Login status check error:", error);
    return res.status(500).json({
      success: false,
      message: "Status check failed",
    });
  }
};
