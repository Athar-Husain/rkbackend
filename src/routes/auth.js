// const express = require("express");
// const router = express.Router();
// const authController = require("../controllers/authController");
// const {
//   validate,
//   validateRegistration,
//   validateOTP,
// } = require("../middleware/validation");
// const { protect } = require("../middleware/auth");

import express from "express";
// import authController from "../controllers/authController.js";
import {
  validate,
  validateRegistration,
  validateOTP,
} from "../middleware/validation.js";
import { protect } from "../middleware/auth.js";
import {
  forgotPassword,
  getDashboard,
  logout,
  registerDevice,
  resetPassword,
  sendOTP,
  signin,
  signup,
  updateProfile,
  validateReferralCode,
  verifyOTP,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/send-otp", sendOTP);
// Public routes
// router.post("/admin-login", );
router.post("/signin", signin);
router.post("/signup", signup);
router.post("/verify-otp", validate(validateOTP), verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/validate-referral/:code", validateReferralCode);

// Protected routes
router.use(protect);
router.get("/dashboard", getDashboard);
router.put("/profile", updateProfile);
router.post("/register-device", registerDevice);
router.post("/logout", logout);

// module.exports = router;

export default router;
