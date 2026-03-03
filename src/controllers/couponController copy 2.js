import mongoose from "mongoose";
import Coupon from "../models/Coupon.model.js";
import User from "../models/User.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import {
  sendBulkNotifications,
  sendPushNotification,
} from "../services/notificationService.js";
import {
  getDiscoverableCoupons,
  getEligibleCouponsForUser,
  isUserEligibleForCoupon,
} from "../services/targetingService.js";
import Purchase from "../models/Purchase.model.js";

/**
 * @desc    Create coupon
 */
export const createCoupon1 = async (req, res, next) => {
  try {
    const newCoupon = await Coupon.create(req.body);

    /* --------------------------------------------------
       SEND NOTIFICATIONS ONLY IF ACTIVE
    -------------------------------------------------- */
    if (newCoupon.status === "ACTIVE") {
      let userQuery = { isActive: true, isBlocked: false };

      const targeting = newCoupon.targeting || {};
      const type = targeting.type || "ALL";

      switch (type) {
        /* ---------------- ALL USERS ---------------- */
        case "ALL":
          break;

        /* ---------------- GEOGRAPHIC ---------------- */
        case "GEOGRAPHIC":
          if (targeting.geographic?.cities?.length) {
            userQuery.city = { $in: targeting.geographic.cities };
          }
          if (targeting.geographic?.areas?.length) {
            userQuery.area = { $in: targeting.geographic.areas };
          }
          break;

        /* ---------------- INDIVIDUAL ---------------- */
        case "INDIVIDUAL":
          if (targeting.users?.length) {
            userQuery._id = { $in: targeting.users };
          } else {
            userQuery._id = null; // No users to notify
          }
          break;

        /* ---------------- PURCHASE_HISTORY ---------------- */
        case "PURCHASE_HISTORY":
          const usersWithPurchase = await Purchase.distinct("userId");
          userQuery._id = { $in: usersWithPurchase };
          break;

        /* ---------------- REFERRAL ---------------- */
        case "REFERRAL":
          userQuery.referredBy = { $exists: true, $ne: null };
          break;

        default:
          userQuery._id = null;
      }

      const targetUsers = await User.find(userQuery).select("_id");
      const userIds = targetUsers.map((u) => u._id);

      if (userIds.length > 0) {
        await sendBulkNotifications(userIds, "User", {
          title: "New Offer for You! 🎁",
          body: `Use code ${newCoupon.code} to get ₹${newCoupon.value} off.`,
          category: "COUPON",
          targetScreen: "COUPON_DETAILS",
          targetId: newCoupon._id.toString(),
          channels: ["PUSH"],
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: newCoupon,
      message: "Coupon created successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const createCoupon2 = async (req, res, next) => {
  try {
    const { productRules = {} } = req.body;

    // --------------------------
    // Upsert new categories/brands from this coupon
    // --------------------------
    const existingCoupons = await Coupon.find({}, { productRules: 1 });

    const allCategories = new Set();
    const allBrands = new Set();

    existingCoupons.forEach((c) => {
      if (c.productRules?.categories?.length)
        c.productRules.categories.forEach((cat) => allCategories.add(cat));
      if (c.productRules?.brands?.length)
        c.productRules.brands.forEach((brand) => allBrands.add(brand));
    });

    // Add current coupon entries
    if (productRules?.categories?.length)
      productRules.categories.forEach((cat) => allCategories.add(cat));
    if (productRules?.brands?.length)
      productRules.brands.forEach((brand) => allBrands.add(brand));

    // Save new coupon
    const newCoupon = await Coupon.create(req.body);

    // --------------------------
    // SEND NOTIFICATIONS ONLY IF ACTIVE
    // --------------------------
    if (newCoupon.status === "ACTIVE") {
      let userQuery = { isActive: true, isBlocked: false };
      const targeting = newCoupon.targeting || {};
      const type = targeting.type || "ALL";

      switch (type) {
        case "ALL":
          break;
        case "GEOGRAPHIC":
          if (targeting.geographic?.cities?.length)
            userQuery.city = { $in: targeting.geographic.cities };
          if (targeting.geographic?.areas?.length)
            userQuery.area = { $in: targeting.geographic.areas };
          break;
        case "INDIVIDUAL":
          userQuery._id = targeting.users?.length
            ? { $in: targeting.users }
            : null;
          break;
        case "PURCHASE_HISTORY":
          const usersWithPurchase = await Purchase.distinct("userId");
          userQuery._id = { $in: usersWithPurchase };
          break;
        case "REFERRAL":
          userQuery.referredBy = { $exists: true, $ne: null };
          break;
        default:
          userQuery._id = null;
      }

      const targetUsers = await User.find(userQuery).select("_id");
      const userIds = targetUsers.map((u) => u._id);

      if (userIds.length > 0) {
        await sendBulkNotifications(userIds, "User", {
          title: "New Offer for You! 🎁",
          body: `Use code ${newCoupon.code} to get ₹${newCoupon.value} off.`,
          category: "COUPON",
          targetScreen: "COUPON_DETAILS",
          targetId: newCoupon._id.toString(),
          channels: ["PUSH"],
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: newCoupon,
      message: "Coupon created successfully",
      dynamicOptions: {
        categories: Array.from(allCategories),
        brands: Array.from(allBrands),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createCoupon3 = async (req, res, next) => {
  try {
    let { productRules } = req.body;

    // -----------------------------
    // Normalize productRules
    // -----------------------------
    if (productRules) {
      // Ensure type exists
      productRules.type = productRules.type || "ALL_PRODUCTS";

      // Initialize categories and brands arrays
      productRules.categories = Array.isArray(productRules.categories)
        ? productRules.categories.map((c) => c.trim())
        : [];
      productRules.brands = Array.isArray(productRules.brands)
        ? productRules.brands.map((b) => b.trim())
        : [];

      // Convert empty strings to remove
      productRules.categories = productRules.categories.filter(Boolean);
      productRules.brands = productRules.brands.filter(Boolean);

      // Ensure ALL_PRODUCTS type clears categories/brands
      if (productRules.type === "ALL_PRODUCTS") {
        productRules.categories = [];
        productRules.brands = [];
      }
    }

    // -----------------------------
    // Create coupon
    // -----------------------------
    const newCoupon = await Coupon.create({
      ...req.body,
      productRules,
    });

    // -----------------------------
    // SEND NOTIFICATIONS IF ACTIVE
    // -----------------------------
    if (newCoupon.status === "ACTIVE") {
      let userQuery = { isActive: true, isBlocked: false };
      const targeting = newCoupon.targeting || {};
      const type = targeting.type || "ALL";

      switch (type) {
        case "ALL":
          break;
        case "GEOGRAPHIC":
          if (targeting.geographic?.cities?.length)
            userQuery.city = { $in: targeting.geographic.cities };
          if (targeting.geographic?.areas?.length)
            userQuery.area = { $in: targeting.geographic.areas };
          break;
        case "INDIVIDUAL":
          if (targeting.users?.length) userQuery._id = { $in: targeting.users };
          else userQuery._id = null;
          break;
        case "PURCHASE_HISTORY":
          const usersWithPurchase = await Purchase.distinct("userId");
          userQuery._id = { $in: usersWithPurchase };
          break;
        case "REFERRAL":
          userQuery.referredBy = { $exists: true, $ne: null };
          break;
        default:
          userQuery._id = null;
      }

      const targetUsers = await User.find(userQuery).select("_id");
      const userIds = targetUsers.map((u) => u._id);

      if (userIds.length > 0) {
        await sendBulkNotifications(userIds, "User", {
          title: "New Offer for You! 🎁",
          body: `Use code ${newCoupon.code} to get ₹${newCoupon.value} off.`,
          category: "COUPON",
          targetScreen: "COUPON_DETAILS",
          targetId: newCoupon._id.toString(),
          channels: ["PUSH"],
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: newCoupon,
      message: "Coupon created successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const createCoupon4 = async (req, res, next) => {
  try {
    let { productRules, notification } = req.body;

    // -----------------------------
    // Normalize productRules
    // -----------------------------
    if (productRules) {
      productRules.type = productRules.type || "ALL_PRODUCTS";
      productRules.categories = Array.isArray(productRules.categories)
        ? productRules.categories.map((c) => c.trim())
        : [];
      productRules.brands = Array.isArray(productRules.brands)
        ? productRules.brands.map((b) => b.trim())
        : [];

      productRules.categories = productRules.categories.filter(Boolean);
      productRules.brands = productRules.brands.filter(Boolean);

      if (productRules.type === "ALL_PRODUCTS") {
        productRules.categories = [];
        productRules.brands = [];
      }
    }

    // -----------------------------
    // Create coupon
    // -----------------------------
    const newCoupon = await Coupon.create({
      ...req.body,
      productRules,
    });

    // -----------------------------
    // SEND NOTIFICATIONS IF ACTIVE
    // -----------------------------
    if (newCoupon.status === "ACTIVE") {
      let userQuery = { isActive: true, isBlocked: false };
      const targeting = newCoupon.targeting || {};
      const type = targeting.type || "ALL";

      switch (type) {
        case "ALL":
          break;
        case "GEOGRAPHIC":
          if (targeting.geographic?.cities?.length)
            userQuery.city = { $in: targeting.geographic.cities };
          if (targeting.geographic?.areas?.length)
            userQuery.area = { $in: targeting.geographic.areas };
          break;
        case "INDIVIDUAL":
          if (targeting.users?.length) userQuery._id = { $in: targeting.users };
          else userQuery._id = null;
          break;
        case "PURCHASE_HISTORY":
          const usersWithPurchase = await Purchase.distinct("userId");
          userQuery._id = { $in: usersWithPurchase };
          break;
        case "REFERRAL":
          userQuery.referredBy = { $exists: true, $ne: null };
          break;
        default:
          userQuery._id = null;
      }

      const targetUsers = await User.find(userQuery).select("_id");
      const userIds = targetUsers.map((u) => u._id);

      if (userIds.length > 0) {
        // -----------------------------
        // Dynamic notification content
        // -----------------------------
        const notifTitle = notification?.title || `New Offer for You! 🎁`;
        const notifBody =
          notification?.body ||
          `Use code ${newCoupon.code} to get ${
            newCoupon.type === "PERCENTAGE"
              ? `${newCoupon.value}% off`
              : `₹${newCoupon.value} off`
          }`;

        await sendBulkNotifications(userIds, "User", {
          title: notifTitle,
          body: notifBody,
          category: "COUPON",
          targetScreen: "COUPON_DETAILS",
          targetId: newCoupon._id.toString(),
          channels: ["PUSH"],
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: newCoupon,
      message: "Coupon created successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    let {
      title,
      code,
      type,
      value,
      validFrom,
      validUntil,
      productRules,
      notification,
      targeting,
      minPurchaseAmount,
    } = req.body;

    // 1. MANDATORY FIELD VALIDATION (Server-Side)
    if (!title || !code || !type || value === undefined || !validUntil) {
      return res.status(400).json({
        success: false,
        message:
          "Missing mandatory fields: Title, Code, Type, Value, and Expiry Date are required.",
      });
    }

    // 2. LOGICAL VALIDATION
    if (type === "PERCENTAGE" && (value <= 0 || value > 100)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Percentage value must be between 1 and 100.",
        });
    }
    if (type === "FIXED_AMOUNT" && value <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Fixed amount must be greater than 0.",
        });
    }

    // 3. DATE VALIDATION
    const startDate = new Date(validFrom || Date.now());
    const expiryDate = new Date(validUntil);
    if (expiryDate <= startDate) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Expiry date must be after the start date.",
        });
    }

    // 4. DUPLICATE CODE CHECK
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
      status: "ACTIVE",
    });
    if (existingCoupon) {
      return res
        .status(400)
        .json({
          success: false,
          message: "An active coupon with this code already exists.",
        });
    }

    // 5. DATA NORMALIZATION (Sanitizing Input)
    const normalizedCode = code.toUpperCase().trim();

    // Sanitize Product Rules
    if (productRules) {
      const pType = productRules.type || "ALL_PRODUCTS";
      productRules.categories =
        pType === "CATEGORY" ? productRules.categories || [] : [];
      productRules.brands = pType === "BRAND" ? productRules.brands || [] : [];
    }

    // 6. RESOLVE TARGETING (CSV Mobiles)
    if (targeting?.type === "INDIVIDUAL" && targeting?.csvMobiles?.length > 0) {
      // Basic check to ensure we aren't processing a million numbers at once
      if (targeting.csvMobiles.length > 5000) {
        return res
          .status(400)
          .json({
            success: false,
            message: "CSV limit exceeded. Max 5000 users per campaign.",
          });
      }

      const users = await User.find({
        mobile: { $in: targeting.csvMobiles },
        isActive: true,
      }).select("_id");

      targeting.users = users.map((u) => u._id);
    }

    // 7. PERSIST TO DATABASE
    const newCoupon = await Coupon.create({
      ...req.body,
      code: normalizedCode,
      productRules,
      targeting,
      // Ensure numbers are actually numbers
      value: Number(value),
      minPurchaseAmount: Number(minPurchaseAmount || 0),
      maxDiscountAmount: Number(req.body.maxDiscountAmount || 0),
      maxRedemptions: Number(req.body.maxRedemptions || 0),
    });

    // 8. NOTIFICATION LOGIC (Placeholder replacement)
    if (newCoupon.status === "ACTIVE") {
      let userQuery = { isActive: true, isBlocked: false };

      // Building User Query
      if (targeting?.type === "GEOGRAPHIC") {
        if (targeting.geographic?.cities?.length)
          userQuery.city = { $in: targeting.geographic.cities };
        if (targeting.geographic?.areas?.length)
          userQuery.area = { $in: targeting.geographic.areas };
      } else if (targeting?.type === "INDIVIDUAL") {
        userQuery._id = { $in: targeting.users || [] };
      }

      const targetUsers = await User.find(userQuery).select("_id");
      const userIds = targetUsers.map((u) => u._id);

      if (userIds.length > 0) {
        const displayValue = type === "PERCENTAGE" ? `${value}%` : `₹${value}`;

        // Use custom body or fallback
        let notifBody =
          notification?.body || "New offer! Use code {code} for {value} off.";
        notifBody = notifBody
          .replace(/{code}/g, newCoupon.code)
          .replace(/{value}/g, displayValue);

        await sendBulkNotifications(userIds, "User", {
          title: notification?.title || "Limited Time Offer! 🎁",
          body: notifBody,
          category: "COUPON",
          targetScreen: "COUPON_DETAILS",
          targetId: newCoupon._id.toString(),
          channels: ["PUSH"],
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: newCoupon,
      message: "Coupon validated, created, and notifications dispatched.",
    });
  } catch (err) {
    // Handle Mongoose Validation Errors specifically
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const getCouponAnalytics = async (req, res, next) => {
  try {
    const stats = await UserCoupon.aggregate([
      {
        $group: {
          _id: "$couponId",
          totalAssigned: { $sum: 1 },
          totalUsed: {
            $sum: { $cond: [{ $eq: ["$status", "USED"] }, 1, 0] },
          },
          totalSavings: { $sum: "$redemption.amountUsed" },
        },
      },
      {
        $lookup: {
          from: "coupons", // Make sure this matches your collection name
          localField: "_id",
          foreignField: "_id",
          as: "couponDetails",
        },
      },
      { $unwind: "$couponDetails" },
    ]);

    res.json({ success: true, stats });
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

// @desc    Get coupons for logged-in user
// @route   GET /api/coupons
// @access  Private
export const getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, count: coupons.length, coupons });
  } catch (err) {
    next(err);
  }
};

// @desc    Get coupon by ID
// @route   GET /api/coupons/:id
// @access  Private
export const getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate(
        "targeting.geographic.stores",
        "name location.address location.city location.area",
      )
      .populate("targeting.users", "name mobile")
      .populate("productRules.products", "name brand model");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    // Check if user is eligible
    // const User = require("../models/User.model.js");
    const user = await User.findById(req.user.id);

    const eligibility = await isUserEligibleForCoupon(user, coupon);

    // Check if user already has this coupon
    const userCoupon = await UserCoupon.findOne({
      userId: req.user.id,
      couponId: coupon._id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    res.status(200).json({
      success: true,
      coupon,
      eligibility,
      alreadyAssigned: !!userCoupon,
      userCoupon: userCoupon
        ? {
            id: userCoupon._id,
            uniqueCode: userCoupon.uniqueCode,
            status: userCoupon.status,
            assignedAt: userCoupon.assignedAt,
          }
        : null,
      instructions: {
        howToUse: "Show the QR code at any participating RK Electronics store",
        validity: `Valid from ${coupon.validFrom.toLocaleDateString()} to ${coupon.validUntil.toLocaleDateString()}`,
        terms: `Minimum purchase: ₹${
          coupon.minPurchaseAmount || 0
        }, Maximum discount: ₹${coupon.maxDiscount || "No limit"}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Claim/Assign coupon to user
// @route   POST /api/coupons/:id/claim
// @access  Private

export const claimCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Initial Fetch
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon not found" });
    }

    // 2. Status & Expiry Checks
    if (coupon.status !== "ACTIVE") {
      return res
        .status(400)
        .json({ success: false, error: "Coupon is no longer active" });
    }
    if (new Date() > coupon.validUntil) {
      return res
        .status(400)
        .json({ success: false, error: "Coupon has expired" });
    }

    // 3. Prevent Duplicates
    const existingUserCoupon = await UserCoupon.findOne({
      userId: userId,
      couponId: id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    if (existingUserCoupon) {
      return res.status(400).json({
        success: false,
        error: "You have already claimed this coupon",
        userCoupon: existingUserCoupon,
      });
    }

    // 4. Eligibility Check
    const user = await User.findById(userId);
    const eligibility = await isUserEligibleForCoupon(user, coupon);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: eligibility.reasons.join(", "),
      });
    }

    // 5. Check Claim Limits (Atomic check without incrementing the usage counter)
    // We check against the Master Coupon's max limit
    if (coupon.currentRedemptions >= coupon.maxRedemptions) {
      return res.status(400).json({
        success: false,
        error: "This offer has reached its maximum limit",
      });
    }

    // 6. Create User-Specific Record (Intent to use)
    const userCoupon = new UserCoupon({
      userId: userId,
      couponId: id,
      status: "ACTIVE", // Ready to be scanned at store
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    });

    await userCoupon.save();

    // 7. Background Notification
    sendPushNotification(
      userId,
      "Coupon Claimed! 🎁",
      `"${coupon.title}" is now in your wallet. Show the QR code at the store to save!`,
    ).catch((err) => console.error("Notification Error:", err));

    res.status(200).json({
      success: true,
      message: "Coupon claimed and added to wallet",
      userCoupon: {
        id: userCoupon._id,
        uniqueCode: userCoupon.uniqueCode,
        qrCodeImage: userCoupon.qrCodeImage,
        status: userCoupon.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate coupon for redemption (for store staff)
// @route   POST /api/coupons/validate
// @access  Private (Store staff)
export const validateCoupon = async (req, res, next) => {
  try {
    const { qrData, manualCode, purchaseAmount = 0 } = req.body;

    if (!qrData && !manualCode) {
      return res.status(400).json({
        success: false,
        error: "Please provide QR data or manual code",
      });
    }

    let validationResult;

    if (qrData) {
      validationResult = await UserCoupon.validateQRCode(qrData);
    } else {
      validationResult = await UserCoupon.validateManualCode(manualCode);
    }

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: validationResult.message,
      });
    }

    const { userCoupon, user, coupon } = validationResult;

    // Check minimum purchase amount
    if (purchaseAmount < coupon.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        error: `Minimum purchase of ₹${coupon.minPurchaseAmount} required`,
      });
    }

    // Calculate discount amount
    const discountAmount = coupon.calculateDiscount(purchaseAmount);

    // Check product restrictions if any
    const productRestrictions = {
      allowed: coupon.productRules.type === "ALL_PRODUCTS",
      categories: coupon.productRules.categories || [],
      products: coupon.productRules.products || [],
      brands: coupon.productRules.brands || [],
    };

    res.status(200).json({
      success: true,
      userCoupon: {
        id: userCoupon._id,
        uniqueCode: userCoupon.uniqueCode,
        status: userCoupon.status,
      },
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        city: user.city,
        area: user.area,
      },
      coupon: {
        id: coupon._id,
        code: coupon.code,
        title: coupon.title,
        type: coupon.type,
        value: coupon.value,
      },
      discount: {
        amount: discountAmount,
        formattedAmount: `₹${discountAmount.toLocaleString("en-IN")}`,
        maxDiscount: coupon.maxDiscount
          ? `₹${coupon.maxDiscount.toLocaleString("en-IN")}`
          : null,
        minPurchase: `₹${coupon.minPurchaseAmount.toLocaleString("en-IN")}`,
      },
      productRestrictions,
      validation: {
        valid: true,
        message: "Coupon is valid for redemption",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCouponProductRulesOptions = async (req, res, next) => {
  try {
    const categories = await Coupon.distinct("productRules.categories");
    const brands = await Coupon.distinct("productRules.brands");

    res.status(200).json({
      success: true,
      categories: categories.filter(Boolean), // remove empty/null
      brands: brands.filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
};

// controllers/couponController.js
// import Coupon from '../models/Coupon.js';

/**
 * Fetch dynamic categories and brands from existing coupons
 */
export const getDynamicOptions = async (req, res, next) => {
  try {
    // Fetch all coupons
    const coupons = await Coupon.find({}, "productRules");

    const categoriesSet = new Set();
    const brandsSet = new Set();

    // Aggregate categories and brands
    coupons.forEach((coupon) => {
      const rules = coupon.productRules || {};
      if (Array.isArray(rules.categories)) {
        rules.categories.forEach((cat) => categoriesSet.add(cat));
      }
      if (Array.isArray(rules.brands)) {
        rules.brands.forEach((brand) => brandsSet.add(brand));
      }
    });

    return res.json({
      success: true,
      dynamicOptions: {
        categories: Array.from(categoriesSet),
        brands: Array.from(brandsSet),
      },
    });
  } catch (err) {
    next(err);
  }
};

// import UserCoupon from "../models/UserCoupon.model.js";
// import Purchase from "../models/Purchase.model.js"; // To link the sale

// 1. Validate (via QR or Manual Code)

export const validateForStaff = async (req, res, next) => {
  try {
    const { code } = req.body; // uniqueCode from the QR scan or manual entry

    // Call the static method you defined in the schema
    const validation = await UserCoupon.validateManualCode2(code);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // If valid, return the populated data for the Staff UI
    res.status(200).json({
      success: true,
      user: validation.user,
      coupon: validation.coupon,
      userCoupon: validation.userCoupon,
      suggestedDiscount: validation.discountAmount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Redeem coupon (for store staff)
// @route   POST /api/coupons/redeem
// @access  Private (Store staff)

export const redeemCoupon = async (req, res, next) => {
  try {
    const staffId = req.user.id;
    const storeId = req.user.storeId;
    const { uniqueCode, orderAmount, purchaseId, notes } = req.body;

    if (!uniqueCode || !orderAmount) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // 1. Find the claimed coupon
    const userCoupon = await UserCoupon.findOne({ uniqueCode }).populate(
      "couponId",
    );

    if (!userCoupon) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid or non-existent coupon code" });
    }

    // 2. Validation: Is it already used?
    if (userCoupon.status === "USED") {
      return res.status(400).json({
        success: false,
        error: "This coupon has already been redeemed",
      });
    }

    const master = userCoupon.couponId;

    // 3. Business Logic: Calculate Savings
    let savings = 0;
    if (master.type === "PERCENTAGE") {
      savings = (orderAmount * master.value) / 100;
      if (master.maxDiscountAmount && savings > master.maxDiscountAmount) {
        savings = master.maxDiscountAmount;
      }
    } else {
      savings = master.value;
    }

    // Ensure savings don't exceed order amount
    savings = Math.min(savings, orderAmount);

    // 4. ATOMIC REDEMPTION
    // This calls your schema method which MUST:
    // a) Set userCoupon.status = 'USED'
    // b) Set redemption details
    // c) Increment master.currentRedemptions
    await userCoupon.redeem(storeId, staffId, purchaseId, savings, notes);

    res.status(200).json({
      success: true,
      message: "Redemption successful",
      data: {
        customerSavings: savings,
        finalPayable: orderAmount - savings,
        couponCode: master.code,
        redeemedAt: new Date(),
      },
    });
  } catch (error) {
    // Catch-all for "Coupon Expired" or "DB Error"
    res.status(400).json({
      success: false,
      error: error.message || "Redemption failed. Please try again.",
    });
  }
};

// @desc    Get coupon redemption history
// @route   GET /api/coupons/:id/redemptions
// @access  Private (Admin)

export const getRedemptionHistory = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon not found" });
    }

    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    // 1. Build Base Query
    const query = { couponId: coupon._id, status: "USED" };

    if (startDate || endDate) {
      query["redemption.redeemedAt"] = {};
      if (startDate) query["redemption.redeemedAt"].$gte = new Date(startDate);
      if (endDate) query["redemption.redeemedAt"].$lte = new Date(endDate);
    }

    // 2. Execute count and find in parallel for performance
    const [userCoupons, totalActualUsed] = await Promise.all([
      UserCoupon.find(query)
        .populate("userId", "name mobile email city area") // Added email
        .populate("redemption.storeId", "name location.city location.area")
        .sort({ "redemption.redeemedAt": -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Use lean for faster read-only queries
      UserCoupon.countDocuments({ couponId: coupon._id, status: "USED" }),
    ]);

    // 3. Professional Stats Calculation
    // We use totalActualUsed to ensure the UI doesn't look "broken"
    const redemptionStats = {
      totalRedemptions: totalActualUsed,
      maxRedemptions: coupon.maxRedemptions,
      remainingRedemptions: Math.max(
        0,
        coupon.maxRedemptions - totalActualUsed,
      ),
      redemptionRate:
        coupon.maxRedemptions > 0
          ? Math.round((totalActualUsed / coupon.maxRedemptions) * 100)
          : 0,
    };

    res.status(200).json({
      success: true,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        value: coupon.value,
      },
      stats: redemptionStats,
      redemptions: userCoupons.map((uc) => ({
        _id: uc._id, // Critical for React keys/DataGrid IDs
        user: uc.userId,
        store: uc.redemption?.storeId,
        amountUsed: uc.redemption?.amountUsed || 0,
        redeemedAt: uc.redemption?.redeemedAt,
        staffId: uc.redemption?.staffId,
      })),
      pagination: {
        totalItems: totalActualUsed,
        totalPages: Math.ceil(totalActualUsed / limit),
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
// 1. GET DISCOVERABLE (Master coupons user hasn't claimed yet)

export const getMyDiscoverableCoupons = async (req, res, next) => {
  try {
    const userId = req.user.id; // from auth middleware

    const result = await getDiscoverableCoupons(userId);

    // Flatten categorized coupons if your service returns categorized structure
    const allCoupons = Object.values(result.categorizedCoupons || {}).flat();


console.log("allCoupons",allCoupons)


    return res.status(200).json({
      success: true,
      count: allCoupons.length,
      coupons: allCoupons,
    });
  } catch (err) {
    next(err); // let global error handler handle it
  }
};

// @desc    Get coupons for logged-in user
// @route   GET /api/coupons
// @access  Private
export const getMyCoupons = async (req, res, next) => {
  console.log("getMyCoupons", getMyCoupons);
  try {
    const { category, type, page = 1, limit = 20 } = req.query;

    // Get eligible coupons for user
    const result = await getEligibleCouponsForUser(req.user.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Failed to get coupons",
      });
    }

    let allCoupons = [];

    // Combine all coupon categories
    Object.values(result.categorizedCoupons).forEach((category) => {
      allCoupons = allCoupons.concat(category);
    });

    // Apply filters
    let filteredCoupons = allCoupons;

    if (category) {
      filteredCoupons = filteredCoupons.filter(
        (coupon) =>
          coupon.productRules.type === "ALL_PRODUCTS" ||
          (coupon.productRules.categories &&
            coupon.productRules.categories.includes(category)),
      );
    }

    if (type) {
      filteredCoupons = filteredCoupons.filter(
        (coupon) => coupon.targeting.type === type.toUpperCase(),
      );
    }

    // Paginate
    const skip = (page - 1) * limit;
    const paginatedCoupons = filteredCoupons.slice(
      skip,
      skip + parseInt(limit),
    );

    res.status(200).json({
      success: true,
      count: paginatedCoupons.length,
      total: filteredCoupons.length,
      pages: Math.ceil(filteredCoupons.length / limit),
      currentPage: page,
      userInfo: result.userInfo,
      categorizedCoupons: result.categorizedCoupons,
      coupons: paginatedCoupons,
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET ACTIVE (Claimed and ready to scan)
export const getMyActiveCoupons = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userCoupons = await UserCoupon.find({
      userId: userId,
      status: "ACTIVE",
      validUntil: { $gt: new Date() }, // Must be in the future
    })
      .populate("couponId")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: userCoupons.length,
      coupons: userCoupons,
    });
  } catch (error) {
    next(error);
  }
};

// 3. GET HISTORY (Used or Expired)

// =========================
// GET MY COUPON HISTORY
// =========================
export const getMyCouponHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const historyCoupons = await UserCoupon.find({
      userId: new mongoose.Types.ObjectId(userId),
      $or: [
        { status: "USED" },
        { status: "EXPIRED" },
        { validUntil: { $lt: now } },
      ],
    })
    .select("-qrCodeData -qrCodeImage") 
      .populate(
        "couponId",
        "code title type value maxDiscount minPurchaseAmount validUntil",
      )
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: historyCoupons.length,
      coupons: historyCoupons,
    });
  } catch (error) {
    console.error("Error in getMyCouponHistory:", error.message);
    next(error);
  }
};

// =========================
// GET MY COUPON SAVINGS
// =========================
export const getMyCouponSavings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const stats = await UserCoupon.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId), status: "USED" },
      },
      {
        $group: {
          _id: null,
          totalSaved: { $sum: "$redemption.amountUsed" },
          totalCount: { $sum: 1 },
          averageSavings: { $avg: "$redemption.amountUsed" },
        },
      },
    ]);

    const {
      totalSaved = 0,
      totalCount = 0,
      averageSavings = 0,
    } = stats[0] || {};

    res.status(200).json({
      success: true,
      savings: {
        totalAmount: totalSaved,
        count: totalCount,
        average: Math.round(averageSavings),
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("Error in getMyCouponSavings:", error.message);
    next(error);
  }
};
