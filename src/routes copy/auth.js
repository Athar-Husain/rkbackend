const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validate,
  validateRegistration,
  validateOTP,
} = require("../middleware/validation");
const { protect } = require("../middleware/auth");

// Public routes
router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", validate(validateOTP), authController.verifyOTP);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/validate-referral/:code", authController.validateReferralCode);

// Protected routes
router.use(protect);
router.get("/dashboard", authController.getDashboard);
router.put("/profile", authController.updateProfile);
router.post("/register-device", authController.registerDevice);
router.post("/logout", authController.logout);

module.exports = router;
