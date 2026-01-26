import Coupon from "../models/Coupon.model.js";
import UserCoupon from "../models/UserCoupon.model.js";
import User from "../models/User.model.js";
import Purchase from "../models/Purchase.model.js";
import NotificationService from "../services/notificationService.js";
import {
  getEligibleCouponsForUser,
  isUserEligibleForCoupon,
} from "../services/targetingService.js";

/* ======================================================
   USER APP CONTROLLERS
====================================================== */

/**
 * GET /api/coupons
 * Fetch eligible coupons for logged in user
 * Filters by city, area & purchase history internally
 */
export const getCoupons = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await getEligibleCouponsForUser(req.user.id);
    if (!result.success) {
      return res.status(400).json({ success: false });
    }

    const coupons = result.coupons;
    const skip = (page - 1) * limit;

    res.json({
      success: true,
      total: coupons.length,
      coupons: coupons.slice(skip, skip + Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/coupons/:id
 * Coupon details + eligibility
 */
export const getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const user = await User.findById(req.user.id);
    const eligibility = await isUserEligibleForCoupon(user, coupon);

    const existing = await UserCoupon.findOne({
      userId: user._id,
      couponId: coupon._id,
    });

    res.json({
      success: true,
      coupon,
      eligibility,
      alreadyClaimed: !!existing,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/coupons/:id/claim
 */
export const claimCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ success: false, error: "Invalid coupon" });
    }

    const user = await User.findById(req.user.id);
    const eligibility = await isUserEligibleForCoupon(user, coupon);
    if (!eligibility.eligible) {
      return res
        .status(400)
        .json({ success: false, error: eligibility.reasons });
    }

    const already = await UserCoupon.findOne({
      userId: user._id,
      couponId: coupon._id,
    });
    if (already) {
      return res.status(400).json({ success: false, error: "Already claimed" });
    }

    const userCoupon = await UserCoupon.create({
      userId: user._id,
      couponId: coupon._id,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    });

    await NotificationService.sendPushNotification(
      user._id,
      "Coupon added to wallet",
      coupon.title,
    );

    res.json({ success: true, userCoupon });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/my-coupons
 */
export const getMyCoupons = async (req, res, next) => {
  try {
    const coupons = await UserCoupon.find({ userId: req.user.id }).populate(
      "couponId",
    );

    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   STORE / POS CONTROLLERS
====================================================== */

/**
 * POST /api/coupons/validate
 */
export const validateCoupon = async (req, res, next) => {
  try {
    const { qrData, manualCode, purchaseAmount } = req.body;

    const result = qrData
      ? await UserCoupon.validateQRCode(qrData)
      : await UserCoupon.validateManualCode(manualCode);

    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.message });
    }

    const discount = result.coupon.calculateDiscount(purchaseAmount);

    res.json({
      success: true,
      userCoupon: result.userCoupon,
      discount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/coupons/redeem
 */
export const redeemCoupon = async (req, res, next) => {
  try {
    const { userCouponId, storeId, purchaseId, staffId, amountUsed } = req.body;

    const userCoupon = await UserCoupon.findById(userCouponId);
    if (!userCoupon) {
      return res.status(404).json({ success: false });
    }

    await userCoupon.redeem(storeId, staffId, purchaseId, amountUsed);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   ADMIN CONTROLLERS
====================================================== */

/**
 * POST /admin/coupons
 */
export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /admin/coupons/:id
 */
export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/coupons/:id (soft delete)
 */
export const deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, { status: "DELETED" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/coupons
 */
export const getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/coupons/:id/activate
 */
export const activateCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, { status: "ACTIVE" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/coupons/:id/pause
 */
export const pauseCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, { status: "PAUSED" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/coupons/:id/redemptions
 */
export const getRedemptionHistory = async (req, res, next) => {
  try {
    const data = await UserCoupon.find({
      couponId: req.params.id,
      status: "USED",
    })
      .populate("userId", "name mobile city area")
      .populate("redemption.storeId", "name");

    res.json({ success: true, redemptions: data });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   TARGETING / RETARGETING (CORE FEATURE)
====================================================== */

/**
 * POST /admin/coupons/:id/preview-users
 * Preview users by area + purchase history
 */
export const previewEligibleUsers = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false });
    }

    const users = await User.find({
      city: { $in: coupon.targeting.geographic.cities },
      area: { $in: coupon.targeting.geographic.areas },
    });

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/campaigns/send
 * Send coupon to targeted users
 */
export const sendCouponCampaign = async (req, res, next) => {
  try {
    const { couponId } = req.body;

    const users = await getEligibleCouponsForUser(null, couponId);

    for (const user of users) {
      await NotificationService.sendPushNotification(
        user._id,
        "Special Offer for You",
        "New coupon available",
      );
    }

    res.json({ success: true, sent: users.length });
  } catch (err) {
    next(err);
  }
};
