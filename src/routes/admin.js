import express from "express";
import multer from "multer";
import { adminProtect } from "../middleware/auth.js";

import {
  // Auth
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  forgotPassword,
  verifyOtp,
  changePassword,
  getLoginStatus,
  getUserProfile,
  updateAdmin,

  // Dashboard
  getDashboard,
  getAdminDashboard,

  // Coupons
  createCoupon,
  updateCoupon,
  getCouponAnalytics,

  // Users
  getUsers,
  exportUsers,

  // Notifications
  sendNotification,

  // Products
  importProducts,
} from "../controllers/adminController.js";

const router = express.Router();

/* ===============================
   Multer Config
================================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

/* ===============================
   PUBLIC ROUTES
================================= */
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);

/* ===============================
   PROTECTED ROUTES
================================= */
router.use(adminProtect);

// Auth
router.get("/login-status", getLoginStatus);
router.get("/profile", getUserProfile);
router.put("/profile", updateAdmin);
router.patch("/change-password", changePassword);
router.post("/logout", logoutAdmin);

// Dashboard
router.get("/dashboard", getDashboard);
// (Remove duplicate getAdminDashboard if unnecessary)

// Coupons
router.post("/coupons", createCoupon);
router.put("/coupons/:id", updateCoupon);
router.get("/coupons/analytics", getCouponAnalytics);

// Users
router.get("/users", getUsers);
router.get("/users/export", exportUsers);

// Notifications
router.post("/notifications", sendNotification);

// Products
router.post("/products/import", upload.single("file"), importProducts);

export default router;
