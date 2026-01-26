import fs from "fs";

import User from "../models/User.model.js";
import Coupon from "../models/Coupon.model.js";
import Product from "../models/Product.model.js";
import Store from "../models/Store.model.js";
import Purchase from "../models/Purchase.model.js";
import UserCoupon from "../models/UserCoupon.model.js";

// import TargetingService from "../services/targetingService.js";
import NotificationService from "../services/notificationService.js";

import {
  exportUsersToExcel,
  importProductsFromExcel,
} from "../utils/excelHelper.js";
import { assignCouponToEligibleUsers } from "../services/targetingService.js";

// import Admin from "../models/Admin.model.js";
import { validationResult } from "express-validator";
import asyncHandler from "express-async-handler";
import nodemailer from "nodemailer";
// import { generateOtp } from "../utils/otp.js";
// import { generateToken } from "../utils/index.js";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/common.js";
import { generateToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_EXPIRY_MINUTES = 10;
// const TOKEN_EXPIRES_IN_SECONDS = 60 * 2; // 2 minutes
const TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24; // 1 day

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
export const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // User stats
    const totalUsers = await User.countDocuments();
    const todayUsers = await User.countDocuments({
      createdAt: { $gte: today },
    });
    const yesterdayUsers = await User.countDocuments({
      createdAt: { $gte: yesterday, $lt: today },
    });

    const userGrowth =
      yesterdayUsers > 0
        ? (((todayUsers - yesterdayUsers) / yesterdayUsers) * 100).toFixed(1)
        : 0;

    // Purchase stats
    const totalPurchases = await Purchase.countDocuments({
      status: "COMPLETED",
    });

    const todayPurchases = await Purchase.countDocuments({
      status: "COMPLETED",
      createdAt: { $gte: today },
    });

    const [todayRevenue] = await Purchase.aggregate([
      { $match: { status: "COMPLETED", createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    const [totalRevenue] = await Purchase.aggregate([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    // Coupon stats
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({
      status: "ACTIVE",
      validUntil: { $gte: new Date() },
    });

    const [todayRedemptions] = await Purchase.aggregate([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: today },
          "couponUsed.userCouponId": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          discount: { $sum: "$discount" },
        },
      },
    ]);

    // Store stats
    const totalStores = await Store.countDocuments({ isActive: true });
    const storeCities = await Store.distinct("location.city", {
      isActive: true,
    });

    // User growth trend
    const userTrend = await User.aggregate([
      { $match: { createdAt: { $gte: lastWeek } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);

    // Top products
    const topProducts = await Purchase.aggregate([
      { $match: { status: "COMPLETED", createdAt: { $gte: lastMonth } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]);

    // City distribution
    const cityDistribution = await User.aggregate([
      { $group: { _id: "$city", users: { $sum: 1 } } },
      { $sort: { users: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        overview: {
          totalUsers,
          todayUsers,
          userGrowth: `${userGrowth}%`,
          totalPurchases,
          todayPurchases,
          todayRevenue: todayRevenue?.total || 0,
          totalRevenue: totalRevenue?.total || 0,
          totalCoupons,
          activeCoupons,
          todayRedemptions: todayRedemptions?.count || 0,
          todayDiscounts: todayRedemptions?.discount || 0,
          totalStores,
          storeCities: storeCities.length,
        },
        trends: {
          userGrowth: userTrend.map((d) => ({
            date: `${d._id.day}/${d._id.month}`,
            users: d.count,
          })),
          topProducts,
          cityDistribution,
        },
        quickStats: {
          avgTransaction:
            totalPurchases > 0
              ? (totalRevenue?.total || 0) / totalPurchases
              : 0,
          redemptionRate:
            totalPurchases > 0
              ? ((todayRedemptions?.count || 0) / totalPurchases) * 100
              : 0,
          userActivation:
            totalUsers > 0 ? (totalPurchases / totalUsers) * 100 : 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create coupon
 */
export const createCoupon = async (req, res, next) => {
  try {
    const data = req.body;

    const exists = await Coupon.findOne({
      code: data.code.toUpperCase(),
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        error: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create({
      ...data,
      code: data.code.toUpperCase(),
      status: "ACTIVE",
      createdBy: req.admin?._id || null,
    });

    let assignment = null;
    if (
      coupon.targeting.type !== "INDIVIDUAL" ||
      coupon.targeting.users?.length
    ) {
      assignment = await assignCouponToEligibleUsers(coupon._id);
    }

    res.status(201).json({
      success: true,
      coupon,
      assignment,
      message: "Coupon created successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update coupon
 */
export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon not found" });
    }

    Object.keys(req.body).forEach((key) => {
      coupon[key] = req.body[key] ?? coupon[key];
    });

    await coupon.save();

    res.json({
      success: true,
      coupon,
      message: "Coupon updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get users
 */
export const getUsers = async (req, res, next) => {
  try {
    const {
      city,
      area,
      search,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
      hasPurchases,
    } = req.query;

    const query = {};

    if (city) query.city = new RegExp(city, "i");
    if (area) query.area = new RegExp(area, "i");

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { mobile: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    if (hasPurchases === "true") {
      const users = await Purchase.distinct("userId");
      query._id = { $in: users };
    }

    const users = await User.find(query)
      .select("-password -deviceTokens")
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const enriched = await Promise.all(
      users.map(async (u) => ({
        ...u.toObject(),
        stats: {
          purchaseCount: await Purchase.countDocuments({ userId: u._id }),
          totalSpent:
            (
              await Purchase.aggregate([
                { $match: { userId: u._id } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } },
              ])
            )[0]?.total || 0,
          activeCoupons: await UserCoupon.countDocuments({
            userId: u._id,
            status: "ACTIVE",
          }),
        },
      })),
    );

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: enriched,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Send notification
 */
export const sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      body,
      target = "ALL",
      cities,
      areas,
      userIds,
      data,
    } = req.body;

    if (!title || !body) {
      return res
        .status(400)
        .json({ success: false, error: "Title and body required" });
    }

    let query = { isActive: true };

    if (target === "CITY") query.city = { $in: cities };
    if (target === "AREA") query.area = { $in: areas };
    if (target === "SPECIFIC") query._id = { $in: userIds };
    if (target === "PURCHASE_HISTORY") {
      query._id = { $in: await Purchase.distinct("userId") };
    }

    const users = await User.find(query).select("_id");

    const result = await NotificationService.sendBulkNotifications(
      users.map((u) => u._id),
      title,
      body,
      "PUSH",
      data,
    );

    res.json({
      success: true,
      result,
      sentTo: users.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Export users
 */
export const exportUsers = async (req, res, next) => {
  try {
    const users = await User.find().select(
      "name mobile email city area createdAt",
    );

    const result = await exportUsersToExcel(users);

    res.download(result.filePath, result.fileName, () => {
      fs.unlinkSync(result.filePath);
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Import products
 */
export const importProducts = async (req, res, next) => {
  try {
    const products = await importProductsFromExcel(req.file.path);

    for (const data of products) {
      await Product.findOneAndUpdate({ sku: data.sku }, data, {
        upsert: true,
      });
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      imported: products.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Coupon analytics
 */
export const getCouponAnalytics = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    const analytics = await Promise.all(
      coupons.map(async (c) => ({
        coupon: c,
        redemptions: await UserCoupon.countDocuments({
          couponId: c._id,
          status: "USED",
        }),
      })),
    );

    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
};

// ================================
// Register Admin
// ================================
export const registerAdmin = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { firstName, lastName, email, password, role } = req.body;

  const existing = await Admin.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "Admin already exists" });
  }

  const newAdmin = new Admin({ firstName, lastName, email, password, role });
  const savedAdmin = await newAdmin.save();

  res.status(201).json({
    message: "Admin registered successfully",
    admin: {
      id: savedAdmin._id,
      email: savedAdmin.email,
      firstName,
      lastName,
      role,
    },
  });
});

// ================================
// Login Admin
// ================================
export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }

  const admin = await Admin.findOne({ email });
  const isMatch = admin && (await admin.comparePassword(password));

  if (!admin || !isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = generateToken(admin._id); // typically expires in 2m
  res.cookie("token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    expires: new Date(Date.now() + TOKEN_EXPIRES_IN_SECONDS * 1000),
  });

  res.status(200).json({
    message: "Login successful",
    token,
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
    id: admin._id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    userType: admin.userType,
    role: admin.role,
  });
});

// ================================
// Get Login Status
// ================================
export const getLoginStatus = asyncHandler(async (req, res) => {
  // console.log('getLoginStatus hit in controllers');
  const authHeader = req.headers.authorization;

  // console.log('authHeader in controllers', authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(200).json(false);
  }

  const token = authHeader.split(" ")[1];
  // console.log('token in controllers', token);
  if (!token) return res.status(401).json(false);

  const verified = jwt.verify(token, JWT_SECRET);
  // console.log('verified', verified);

  try {
    if (verified) {
      return res.json(true);
    } else {
      return res.json(false);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ================================
// Get Admin Profile
// ================================
export const getUserProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user.id).select(
    "-password -resetOtp -otpExpiry",
  );

  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  res.status(200).json({ admin });
});

// ================================
// Update Admin
// ================================
export const updateAdmin = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, role } = req.body;

  const updated = await Admin.findByIdAndUpdate(
    req.user.id,
    { firstName, lastName, email, role },
    { new: true, runValidators: true },
  );

  if (!updated) {
    return res.status(404).json({ message: "Admin not found" });
  }

  res.status(200).json({
    message: "Profile updated",
    admin: {
      id: updated._id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
    },
  });
});

// ================================
// Forgot Password
// ================================
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const otp = generateOTP();
  const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset OTP",
    text: `Your OTP is: ${otp}`,
  });

  admin.resetOtp = otp;
  admin.otpExpiry = expiry;
  await admin.save();

  res.status(200).json({ message: "OTP sent to email" });
});

// ================================
// Verify OTP
// ================================
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const admin = await Admin.findOne({ email });

  if (!admin || admin.resetOtp !== otp || new Date() > admin.otpExpiry) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  res.status(200).json({ message: "OTP verified" });
});

// ================================
// Change Password
// ================================
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const admin = await Admin.findById(req.user.id);

  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const isMatch = await admin.comparePassword(oldPassword);
  if (!isMatch) {
    return res.status(400).json({ message: "Old password is incorrect" });
  }

  admin.password = newPassword;
  await admin.save();

  res.status(200).json({ message: "Password changed successfully" });
});

// ================================
// Logout Admin (Client clears token)
// ================================
export const logoutAdmin = asyncHandler(async (req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
});
