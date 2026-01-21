const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { adminProtect } = require("../middleware/auth");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// All routes require admin authentication
router.use(adminProtect);

// Dashboard
router.get("/dashboard", adminController.getDashboard);

// Coupon management
router.post("/coupons", adminController.createCoupon);
router.put("/coupons/:id", adminController.updateCoupon);
router.get("/coupons/analytics", adminController.getCouponAnalytics);

// User management
router.get("/users", adminController.getUsers);
router.get("/users/export", adminController.exportUsers);

// Notifications
router.post("/notifications", adminController.sendNotification);

// Product management
router.post(
  "/products/import",
  upload.single("file"),
  adminController.importProducts
);

module.exports = router;
