import express from "express";
import AuthController from "../controllers/auth.controller-new.js";
import CityController from "../controllers/city.controller.js";
import {
  protect,
  refreshToken,
  restrictTo,
} from "../middleware/auth.middleware.js";
import {
  genericLimiter,
  authLimiter,
  otpLimiter,
  signupLimiter,
  loginLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

// Public routes
router.post("/signup", signupLimiter, AuthController.signup);
router.post("/verify-otp", otpLimiter, AuthController.verifyOTP);
router.post("/signin", loginLimiter, AuthController.signin);
router.post("/forgot-password", authLimiter, AuthController.forgotPassword);
router.post("/reset-password", authLimiter, AuthController.resetPassword);
router.post("/resend-otp", otpLimiter, AuthController.resendOTP);
router.get("/validate-referral/:code", AuthController.validateReferralCode);

// City/Area routes
router.get("/cities", CityController.getCities);
router.get("/cities/:cityId/areas", CityController.getAreasByCity);
router.get("/cities/search", CityController.searchCities);
router.post("/cities/check-availability", CityController.checkAvailability);

// Token refresh
router.post("/refresh-token", genericLimiter, refreshToken, (req, res) => {
  res.status(200).json({
    success: true,
    token: req.newToken,
    refreshToken: req.newRefreshToken,
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      userType: req.user.userType,
    },
  });
});

// Protected routes (require authentication)
router.use(protect);

router.get("/dashboard", genericLimiter, AuthController.getDashboard);
router.get("/profile", genericLimiter, AuthController.getProfile);
router.patch("/profile", genericLimiter, AuthController.updateProfile);
router.post("/register-device", genericLimiter, AuthController.registerDevice);
router.post("/logout", genericLimiter, AuthController.logout);
router.get("/login-status", genericLimiter, AuthController.getLoginStatus);

// Admin only routes
router.get("/admin/users", restrictTo("Admin"), genericLimiter, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin route - User list",
  });
});

export default router;
