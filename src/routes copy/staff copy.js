import express from "express";
import {
  sendOTP,
  verifyOTP,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  registerDevice,
  logout,
  getLoginStatus,
  getDashboard,
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} from "../controllers/staffController.js";
import { adminProtect, staffProtect } from "../middleware/auth.js";

// import { protectStaff, protectAdmin } from "../middleware/auth.js";

const router = express.Router();

// ============================
// Public Routes
// ============================
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/login-status", getLoginStatus);

// ============================
// Protected Staff Routes
// ============================
// router.use(staffProtect); // all routes below require staff authentication

router.get("/profile", staffProtect, getProfile);
router.patch("/profile", staffProtect, updateProfile);
router.post("/register-device", staffProtect, registerDevice);
router.post("/logout", staffProtect, logout);
router.get("/dashboard", staffProtect, getDashboard);

// ============================
// Admin Routes: Manage Staff Members
// ============================
// router.use(adminProtect); // routes below require admin privileges

router.post("/createStaff", adminProtect, createStaff);
router.get("/getAllStaff", adminProtect, getAllStaff);
router.get("/getStaffById/:id", adminProtect, getStaffById);
router.patch("/updateStaff/:id", adminProtect, updateStaff);
router.delete("/deleteStaff/:id", adminProtect, deleteStaff);

export default router;
