import { Router } from "express";

/* ----------- AUTH MIDDLEWARE ----------- */
// import authMiddleware from "../middlewares/auth.middleware.js";

/* ----------- CONTROLLERS ----------- */
import {
  // Signup
  signupSendOTP,
  signupVerifyOTP,

  // Signin
  signinSendOTP,
  signinVerifyOTP,

  // Password reset
  forgotPassword,
  resetPassword,

  // Referral
  validateReferralCode,

  // User data
  getDashboard,
  getProfile,
  updateProfile,
  getLoginStatus,

  // Device & session
  registerDevice,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

/* =====================================================
   PUBLIC ROUTES (NO AUTH REQUIRED)
===================================================== */

/* ----------- SIGNUP ----------- */
router.post("/signup/send-otp", signupSendOTP);
router.post("/signup/verify-otp", signupVerifyOTP);

/* ----------- SIGNIN ----------- */
router.post("/signin/send-otp", signinSendOTP);
router.post("/signin/verify-otp", signinVerifyOTP);

/* ----------- PASSWORD RESET ----------- */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* ----------- REFERRAL ----------- */
router.get("/referral/:code", validateReferralCode);

/* =====================================================
   PROTECTED ROUTES (AUTH REQUIRED)
===================================================== */

// router.use(authMiddleware);

/* ----------- USER ----------- */
router.get("/dashboard", protect, getDashboard);
router.get("/profile", protect, getProfile);
router.put("/profile", updateProfile);
router.get("/login-status", protect, getLoginStatus);

/* ----------- DEVICE & SESSION ----------- */
router.post("/register-device", protect, registerDevice);
router.post("/logout", protect, logout);

export default router;
