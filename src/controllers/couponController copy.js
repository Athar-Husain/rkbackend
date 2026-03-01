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
  isUserEligibleForCoupon2,
} from "../services/targetingService.js";
import Purchase from "../models/Purchase.model.js";
// import NotificationService from "../services/notificationService.js";
// import { sendPushNotification } from "../utils/notification.js"; // Your existing helper

/**
 * @desc    Create coupon
 */

export const createCoupon2 = async (req, res, next) => {
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

export const getCouponAnalytics1 = async (req, res, next) => {
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
export const getCouponAnalytics2 = async (req, res, next) => {
  try {
    const stats = await UserCoupon.aggregate([
      { $match: { status: "USED" } },
      { $group: { _id: "$couponId", redemptionCount: { $sum: 1 } } },
    ]);
    // Join this with your Coupon data if needed
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

export const claimCoupon2 = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    // Check if coupon is active
    if (coupon.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        error: "Coupon is not active",
      });
    }

    // Check if coupon has expired
    if (new Date() > coupon.validUntil) {
      return res.status(400).json({
        success: false,
        error: "Coupon has expired",
      });
    }

    // Check redemption limits
    if (coupon.currentRedemptions >= coupon.maxRedemptions) {
      return res.status(400).json({
        success: false,
        error: "Coupon redemption limit reached",
      });
    }

    // Check user eligibility
    // const User = require("../models/User.model.js");
    const user = await User.findById(req.user.id);

    const eligibility = await isUserEligibleForCoupon(user, coupon);

    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: eligibility.reasons.join(", "),
      });
    }

    // Check if user already has this coupon
    const existingUserCoupon = await UserCoupon.findOne({
      userId: req.user.id,
      couponId: coupon._id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    if (existingUserCoupon) {
      return res.status(400).json({
        success: false,
        error: "You already have this coupon",
        userCoupon: existingUserCoupon,
      });
    }

    // Create user coupon
    const userCoupon = new UserCoupon({
      userId: req.user.id,
      couponId: coupon._id,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    });

    await userCoupon.save();

    // Send notification to user
    await sendPushNotification(
      req.user.id,
      "Coupon Claimed!",
      `You have successfully claimed "${coupon.title}" coupon. Check your wallet to use it.`,
    );

    res.status(200).json({
      success: true,
      message: "Coupon claimed successfully",
      userCoupon: {
        id: userCoupon._id,
        uniqueCode: userCoupon.uniqueCode,
        qrCodeImage: userCoupon.qrCodeImage,
        validUntil: userCoupon.validUntil,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const validateForStaff1 = async (req, res) => {
  try {
    const { code, type, purchaseAmount, cartItems } = req.body;
    // 'code' is either the decrypted QR string or the manual 6-digit code

    let result;
    if (type === "QR") {
      result = await UserCoupon.validateQRCode(code);
    } else {
      result = await UserCoupon.validateManualCode(code);
    }

    if (!result.valid)
      return res.status(400).json({ success: false, message: result.message });

    const { coupon, user, userCoupon } = result;

    // Check Product Restrictions (Refined logic)
    const isProductValid =
      coupon.productRules.type === "ALL_PRODUCTS" ||
      cartItems.some((item) => {
        if (coupon.productRules.type === "CATEGORY")
          return coupon.productRules.categories.includes(item.category);
        if (coupon.productRules.type === "BRAND")
          return coupon.productRules.brands.includes(item.brand);
        return false;
      });

    if (!isProductValid) {
      return res.status(400).json({
        success: false,
        message: "Coupon not valid for items in cart",
      });
    }

    const discount = coupon.calculateDiscount(purchaseAmount);

    res.json({
      success: true,
      data: {
        userCouponId: userCoupon._id,
        userName: user.name,
        discountAmount: discount,
        finalPayable: purchaseAmount - discount,
        couponTitle: coupon.title,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCoupon = async (req, res, next) => {
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
export const claimCoupon3 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Initial Fetch to check basic status (Non-atomic checks first to save performance)
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon not found" });
    }

    // Check basic status and expiry
    if (coupon.status !== "ACTIVE") {
      return res
        .status(400)
        .json({ success: false, error: "Coupon is not active" });
    }

    if (new Date() > coupon.validUntil) {
      return res
        .status(400)
        .json({ success: false, error: "Coupon has expired" });
    }

    // 2. Check if user already claimed it (Prevent duplicates)
    const existingUserCoupon = await UserCoupon.findOne({
      userId: userId,
      couponId: id,
      status: { $in: ["ACTIVE", "USED"] },
    });

    if (existingUserCoupon) {
      return res.status(400).json({
        success: false,
        error: "You already have this coupon",
        userCoupon: existingUserCoupon,
      });
    }

    // 3. Check user eligibility (City, Area, Category logic)
    const user = await User.findById(userId);
    const eligibility = await isUserEligibleForCoupon(user, coupon);

    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: eligibility.reasons.join(", "),
      });
    }

    // 4. ATOMIC OPERATION: Increment and Check Limit simultaneously
    // This is the "Gold Standard" for high-traffic apps
    const updatedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: id,
        currentRedemptions: { $lt: coupon.maxRedemptions },
        status: "ACTIVE", // Ensure it didn't get deactivated mid-process
      },
      { $inc: { currentRedemptions: 1 } },
      { new: true },
    );

    if (!updatedCoupon) {
      return res.status(400).json({
        success: false,
        error: "Coupon limit reached or offer no longer available!",
      });
    }

    // 5. Create the User-Specific Coupon entry
    const userCoupon = new UserCoupon({
      userId: userId,
      couponId: id,
      validFrom: updatedCoupon.validFrom,
      validUntil: updatedCoupon.validUntil,
      // uniqueCode is usually generated automatically in UserCoupon schema
    });

    await userCoupon.save();

    // 6. Send notification (Async, don't block the response)
    sendPushNotification(
      userId,
      "Coupon Claimed!",
      `You have successfully claimed "${updatedCoupon.title}". Check your wallet to use it.`,
    ).catch((err) => console.log("Notification Error:", err));

    // 7. Success Response
    res.status(200).json({
      success: true,
      message: "Coupon claimed successfully",
      // Include the coupon object so Redux can update the 'Master' state
      coupon: updatedCoupon,
      userCoupon: {
        id: userCoupon._id,
        uniqueCode: userCoupon.uniqueCode,
        qrCodeImage: userCoupon.qrCodeImage,
        validUntil: userCoupon.validUntil,
        status: userCoupon.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
export const redeemCoupon1 = async (req, res, next) => {
  try {
    const {
      userCouponId,
      storeId,
      staffId,
      purchaseId,
      amountUsed,
      notes = "",
    } = req.body;

    if (!userCouponId || !storeId || !staffId || !purchaseId || !amountUsed) {
      return res.status(400).json({
        success: false,
        error: "Please provide all required fields",
      });
    }

    const userCoupon = await UserCoupon.findById(userCouponId)
      .populate("userId", "name mobile")
      .populate("couponId", "code title");

    if (!userCoupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    // Redeem the coupon
    await userCoupon.redeem(storeId, staffId, purchaseId, amountUsed, notes);

    // Send confirmation to user
    await sendSMS(
      userCoupon.userId.mobile,
      `Your coupon "${userCoupon.couponId.title}" has been redeemed for ₹${amountUsed} at RK Electronics. Thank you for shopping with us!`,
    );

    res.status(200).json({
      success: true,
      message: "Coupon redeemed successfully",
      redemption: {
        userCouponId: userCoupon._id,
        userId: userCoupon.userId._id,
        userName: userCoupon.userId.name,
        couponCode: userCoupon.couponId.code,
        amountUsed,
        redeemedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const redeemCoupon2 = async (req, res, next) => {
  try {
    const staffId = req.user.id; // From auth middleware
    console.log("staffId", staffId);
    console.log("req.user.storeId", req.user.storeId);
    const { uniqueCode, orderAmount, purchaseId, notes } = req.body;
    let storeId = req.user.storeId;

    // 1. Find the UserCoupon and the Master Coupon details
    const userCoupon = await UserCoupon.findOne({ uniqueCode }).populate(
      "couponId",
    );

    if (!userCoupon) {
      return res
        .status(404)
        .json({ success: false, error: "Coupon not found" });
    }

    // 2. Calculate the "amountUsed" (the actual savings)
    const master = userCoupon.couponId;
    let savings = 0;

    if (master.type === "PERCENTAGE") {
      savings = (orderAmount * master.value) / 100;
      // Apply cap if exists
      if (master.maxDiscountAmount && savings > master.maxDiscountAmount) {
        savings = master.maxDiscountAmount;
      }
    } else {
      // FLAT discount
      savings = master.value;
    }

    // 3. Use your schema method to handle the heavy lifting
    // This updates status to 'USED', increments Master count, and saves
    await userCoupon.redeem(
      storeId,
      staffId,
      purchaseId,
      savings, // This maps to 'amountUsed' in your schema
      notes,
    );

    res.status(200).json({
      success: true,
      message: "Redemption successful",
      data: {
        savingsAmount: savings,
        finalBill: orderAmount - savings,
        uniqueCode: userCoupon.uniqueCode,
      },
    });
  } catch (error) {
    // If your schema method throws "Coupon has expired", it lands here
    res.status(400).json({ success: false, error: error.message });
  }
};

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
      return res
        .status(400)
        .json({
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
export const getRedemptionHistory1 = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const query = { couponId: coupon._id, status: "USED" };

    if (startDate || endDate) {
      query["redemption.redeemedAt"] = {};
      if (startDate) query["redemption.redeemedAt"].$gte = new Date(startDate);
      if (endDate) query["redemption.redeemedAt"].$lte = new Date(endDate);
    }

    const userCoupons = await UserCoupon.find(query)
      .populate("userId", "name mobile city area")
      .populate("redemption.storeId", "name location.city location.area")
      .sort({ "redemption.redeemedAt": -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserCoupon.countDocuments(query);

    // Calculate redemption stats
    const redemptionStats = {
      totalRedemptions: coupon.currentRedemptions,
      maxRedemptions: coupon.maxRedemptions,
      remainingRedemptions: coupon.maxRedemptions - coupon.currentRedemptions,
      redemptionRate: Math.round(
        (coupon.currentRedemptions / coupon.maxRedemptions) * 100,
      ),
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
        user: uc.userId,
        store: uc.redemption.storeId,
        amountUsed: uc.redemption.amountUsed,
        redeemedAt: uc.redemption.redeemedAt,
        staffId: uc.redemption.staffId,
      })),
      count: userCoupons.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    next(error);
  }
};

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

// getMyActiveCoupons
// getDiscoverableCoupons
// getMyCouponHistory
// getMyCouponSavings
