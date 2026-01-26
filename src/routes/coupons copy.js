// const express = require("express");
// const router = express.Router();
// const couponController = require('../controllers/couponController');
// const { protect, staffProtect } = require('../middleware/auth');

//
import express from "express";
// import {} from "";
import { protect, staffProtect } from "../middleware/auth.js";
import {
  claimCoupon,
  getCouponById,
  getCoupons,
  redeemCoupon,
  validateCoupon,
} from "../controllers/couponController.js";

const router = express.Router();

// User routes
router.use(protect);
router.get("/", getCoupons);
router.get("/:id", getCouponById);
router.post("/:id/claim", claimCoupon);

// Store staff routes
router.post("/validate", staffProtect, validateCoupon);
router.post("/redeem", staffProtect, redeemCoupon);

// module.exports = router;

export default router;
