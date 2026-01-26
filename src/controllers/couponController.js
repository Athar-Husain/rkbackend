import Coupon from "../models/Coupon.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import {
  getEligibleCouponsForUser,
  isUserEligibleForCoupon,
} from "../services/targetingService.js";
import NotificationService from "../services/notificationService.js";

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

// @desc    Get coupons for logged-in user
// @route   GET /api/coupons
// @access  Private
export const getMyCoupons = async (req, res, next) => {
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
    const User = require("../models/User.model.js");
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
    const User = require("../models/User.model.js");
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
    await NotificationService.sendPushNotification(
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

// @desc    Redeem coupon (for store staff)
// @route   POST /api/coupons/redeem
// @access  Private (Store staff)
export const redeemCoupon = async (req, res, next) => {
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
    await NotificationService.sendSMS(
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

// @desc    Get coupon redemption history
// @route   GET /api/coupons/:id/redemptions
// @access  Private (Admin)
export const getRedemptionHistory = async (req, res, next) => {
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
