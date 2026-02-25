// routes/auth.routes.js
import express from "express";
import {
  signupSendOTP,
  signupVerifyOTP,
  signinSendOTP,
  signinVerifyOTP,
  forgotPassword,
  resetPassword,
  logout,
  getProfile,
  registerFCMToken,
  getLoginStatus,
  refreshToken,
  validateReferralCode,
  getDashboard,
  updateProfile,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
// import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/signup/send-otp", signupSendOTP);
router.post("/signup/verify-otp", signupVerifyOTP);
router.post("/signin/send-otp", signinSendOTP);
router.post("/signin/verify-otp", signinVerifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/referral/validate/:code", validateReferralCode);
router.post("/refresh-token", refreshToken);

// Protected routes
// router.use(authenticate); // All routes below require authentication

router.post("/logout", protect, logout);
router.get("/profile", protect, getProfile);
// router.put("/profile", updateProfile);
router.post("/device/register", protect, registerFCMToken); // Register/update FCM token
router.get("/login-status", protect, getLoginStatus);
router.get("/dashboard", getDashboard);

export default router;
