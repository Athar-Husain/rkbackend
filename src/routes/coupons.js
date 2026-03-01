import express from "express";
import {
  createCoupon,
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
  getMyCouponHistory,
  getMyCouponSavings,
  getMyDiscoverableCoupons,
  getDynamicOptions,
} from "../controllers/couponController.js";
import {
  adminStaffProtect,
  protect,
  adminProtect,
  staffProtect,
} from "../middleware/auth.js";

const router = express.Router();

// @route   POST /api/coupons
// @desc    Create a new coupon
// @access  Private (Admin only)
router.post("/createCoupon", adminProtect, createCoupon); // Use protect and admin middleware for authorization

router.get("/analytics", adminProtect, getCouponAnalytics);

router.put("/updateCoupon/:id", adminProtect, updateCoupon);

router.get("/getAllCoupons", adminProtect, getAllCoupons);

router.get("/getmycoupons", protect, getMyCoupons);
router.get("/getMyCouponSavings", protect, getMyCouponSavings);
router.get("/getMyCouponHistory", protect, getMyCouponHistory);
router.get("/getDiscoverableCoupons", protect, getMyDiscoverableCoupons);
router.get("/getmyactivecoupons", protect, getMyActiveCoupons);

router.get("/getCouponById/:id", protect, getCouponById);
router.get('/dynamicoptions', getDynamicOptions);

router.post("/claimCoupon/:id/claim", protect, claimCoupon);

router.post("/validate", adminStaffProtect, validateCoupon);
router.post("/validateForStaff", staffProtect, validateForStaff);
router.post("/redeem", adminStaffProtect, redeemCoupon);

router.get(
  "/getRedemptionHistory/:id/redemptions",
  adminProtect,
  getRedemptionHistory,
);

export default router;
