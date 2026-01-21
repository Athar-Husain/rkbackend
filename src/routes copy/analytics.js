const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { adminProtect } = require("../middleware/auth");

// All routes require admin authentication
router.use(adminProtect);

router.get("/sales", analyticsController.getSalesAnalytics);
router.get("/users", analyticsController.getUserAnalytics);
router.get("/coupons", analyticsController.getCouponAnalytics);
router.get("/stores", analyticsController.getStoreAnalytics);

module.exports = router;
