import express from "express";
import {
  createStaff,
  staffSigninSendOTP,
  staffSigninVerifyOTP,
  registerStaffFCMToken,
  staffLogout,
  getStaffProfile,
  updateStaffProfile,
  staffRefreshToken,
  staffForgotPassword,
  staffResetPassword,
  getAllStaff,
  getStaffById,
  deleteStaff,
  getStaffDashboard,
  getStaffLoginStatus,
} from "../controllers/staffController.js";
import { adminProtect, staffProtect } from "../middleware/auth.js";

const router = express.Router();

// ============================
// Public Routes
// ============================
router.post("/send-otp", staffSigninSendOTP);
router.post("/verify-otp", staffSigninVerifyOTP);
router.post("/forgot-password", staffForgotPassword);
router.post("/reset-password", staffResetPassword);
router.post("/refresh-token", staffRefreshToken);

// ============================
// Protected Staff Routes
// ============================
router.get("/profile", staffProtect, getStaffProfile);
router.patch("/profile", staffProtect, updateStaffProfile);
router.post("/register-device", staffProtect, registerStaffFCMToken);
router.post("/logout", staffProtect, staffLogout);
router.get("/dashboard", staffProtect, getStaffDashboard);
router.get("/login-status", staffProtect, getStaffLoginStatus);

// ============================
// Admin Routes: Manage Staff Members
// ============================
router.post("/create", adminProtect, createStaff);
router.get("/getAllStaff", adminProtect, getAllStaff);
router.get("/getStaffById/:id", adminProtect, getStaffById);
router.delete("/deleteStaff/:id", adminProtect, deleteStaff);

export default router;
