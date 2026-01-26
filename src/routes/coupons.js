import express from "express";
import {
  createCoupon,
  getMyCoupons,
  getCouponById,
  claimCoupon,
  validateCoupon,
  redeemCoupon,
  getRedemptionHistory,
  getAllCoupons,
  updateCoupon,
  getCouponAnalytics,
} from "../controllers/couponController.js";
import { adminProtect, protect, staffProtect } from "../middleware/auth.js";

const router = express.Router();

/**
 * =========================
 * Admin Routes
 * =========================
 */

// Create a coupon
router.post("/createCoupon", adminProtect, createCoupon);

// Get coupon redemption history
router.get(
  "/getRedemptionHistory/:id/redemptions",
  adminProtect,
  getRedemptionHistory,
);
router.get("/getAllCoupons", adminProtect, getAllCoupons);
router.patch("/updateCoupon/:id", adminProtect, updateCoupon);
router.get("/getAnalytics", adminProtect, getCouponAnalytics);

/**
 * =========================
 * User Routes
 * =========================
 */

// Get all eligible coupons for logged-in user
router.get("/getMyCoupons", protect, getMyCoupons);

// Get coupon by ID
router.get("/getCouponById/:id", protect, getCouponById);

// Claim a coupon
router.post("/claimCoupon/:id/claim", protect, claimCoupon);

/**
 * =========================
 * Store Staff Routes
 * =========================
 */

// Validate coupon (QR / manual code)
router.post("/validate", staffProtect, validateCoupon);

// Redeem coupon
router.post("/redeem", staffProtect, redeemCoupon);

export default router;
