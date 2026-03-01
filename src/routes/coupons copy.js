import express from "express";
import {
  createCoupon,
  // createCoupon2,
  // getCouponAnalytics1,
  // getCouponAnalytics2,
  getCouponAnalytics,
  updateCoupon,
  getAllCoupons,
  getMyCoupons,
  getCouponById,
  claimCoupon,
  validateCoupon,
  validateForStaff,
  redeemCoupon,
  getRedemptionHistory,
  getMyActiveCoupons,
  // getDiscoverableCoupons,
  getMyCouponHistory,
  getMyCouponSavings,
  getMyDiscoverableCoupons,
} from "../controllers/couponController.js";
// import { adminProtect, protect } from "../middleware/auth.middleware.js";
import {
  adminStaffProtect,
  protect,
  adminProtect,
  staffProtect,
} from "../middleware/auth.js";
// import { protect, admin } from "../middleware/authMiddleware.js"; // Add appropriate middleware

const router = express.Router();

// @route   POST /api/coupons
// @desc    Create a new coupon
// @access  Private (Admin only)
router.post("/createCoupon", adminProtect, createCoupon); // Use protect and admin middleware for authorization

// @route   POST /api/coupons/v2
// @desc    Create a new coupon (alternative version)
// @access  Private (Admin only)
// router.post("/createCoupon2", adminProtect, createCoupon2);

// @route   GET /api/coupons/analytics1
// @desc    Get coupon analytics (version 1)
// @access  Private (Admin only)
// router.get("/analytics1", adminProtect, getCouponAnalytics1);

// @route   GET /api/coupons/analytics2
// @desc    Get coupon analytics (version 2)
// @access  Private (Admin only)
// router.get("/analytics2", adminProtect, getCouponAnalytics2);

// @route   GET /api/coupons/analytics
// @desc    Get coupon analytics (aggregated stats)
// @access  Private (Admin only)
router.get("/analytics", adminProtect, getCouponAnalytics);

// @route   PUT /api/coupons/:id
// @desc    Update an existing coupon
// @access  Private (Admin only)
router.put("/updateCoupon/:id", adminProtect, updateCoupon);

// @route   GET /api/coupons
// @desc    Get all coupons
// @access  Private (Admin only)
router.get("/getAllCoupons", adminProtect, getAllCoupons);

// @route   GET /api/coupons/my
// @desc    Get coupons for logged-in user
// @access  Private
router.get("/getmycoupons", protect, getMyCoupons);
router.get("/getMyCouponSavings", protect, getMyCouponSavings);
router.get("/getMyCouponHistory", protect, getMyCouponHistory);
// router.get("/getDiscoverableCoupons", protect, getDiscoverableCoupons);
router.get("/getDiscoverableCoupons", protect, getMyDiscoverableCoupons);
router.get("/getmyactivecoupons", protect, getMyActiveCoupons);
// router.get("/getmycoupons", protect, getMyCoupons);

// @route   GET /api/coupons/:id
// @desc    Get a coupon by ID
// @access  Private
router.get("/getCouponById/:id", protect, getCouponById);

// @route   POST /api/coupons/:id/claim
// @desc    Claim a coupon for the logged-in user
// @access  Private
router.post("/claimCoupon/:id/claim", protect, claimCoupon);

// @route   POST /api/coupons/validate
// @desc    Validate a coupon (QR/Manual code)
// @access  Private (Store staff)
router.post("/validate", adminStaffProtect, validateCoupon);

// @route   POST /api/coupons/validateForStaff
// @desc    Validate coupon for store staff (QR/Manual code)
// @access  Private (Store staff)
router.post("/validateForStaff", staffProtect, validateForStaff);

// @route   POST /api/coupons/redeem
// @desc    Redeem a coupon (for store staff)
// @access  Private (Store staff)
router.post("/redeem", adminStaffProtect, redeemCoupon);

// @route   GET /api/coupons/:id/redemptions
// @desc    Get redemption history of a coupon
// @access  Private (Admin only)
router.get(
  "/getRedemptionHistory/:id/redemptions",
  adminProtect,
  getRedemptionHistory,
);

export default router;
