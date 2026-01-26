// const express = require("express");
// const userController = require("../controllers/userController");
// const { protect } = require("../middleware/auth");

import express from "express";
import { protect } from "../middleware/auth.js";
import {
  deleteAccount,
  getAddresses,
  getCouponById,
  getProfile,
  getPurchaseById,
  getPurchaseHistory,
  getReferralInfo,
  getUserCoupons,
  updatePreferences,
} from "../controllers/userController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get("/profile", getProfile);
router.put("/preferences", updatePreferences);
router.delete("/account", deleteAccount);
router.get("/coupons", getUserCoupons);
router.get("/coupons/:id", getCouponById);
router.get("/purchases", getPurchaseHistory);
router.get("/purchases/:id", getPurchaseById);
router.get("/referral", getReferralInfo);
router.get("/addresses", getAddresses);

// module.exports = router;

export default router;
