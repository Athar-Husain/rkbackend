import express from "express";
import multer from "multer";

// import adminController from "../controllers/adminController.js";
import { adminProtect } from "../middleware/auth.js";
import {
  createCoupon,
  exportUsers,
  getCouponAnalytics,
  getDashboard,
  getUsers,
  importProducts,
  sendNotification,
  updateCoupon,
} from "../controllers/adminController.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// All routes require admin authentication
router.use(adminProtect);

// Dashboard
router.get("/dashboard", getDashboard);

// Coupon management
router.post("/coupons", createCoupon);
router.put("/coupons/:id", updateCoupon);
router.get("/coupons/analytics", getCouponAnalytics);

// User management
router.get("/users", getUsers);
router.get("/users/export", exportUsers);

// Notifications
router.post("/notifications", sendNotification);

// Product management
router.post("/products/import", upload.single("file"), importProducts);

export default router;
