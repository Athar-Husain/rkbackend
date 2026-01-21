const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

router.get("/profile", userController.getProfile);
router.get("/coupons", userController.getUserCoupons);
router.get("/coupons/:id", userController.getCouponById);
router.get("/purchases", userController.getPurchaseHistory);
router.get("/purchases/:id", userController.getPurchaseById);
router.get("/referral", userController.getReferralInfo);
router.put("/preferences", userController.updatePreferences);
router.get("/addresses", userController.getAddresses);
router.delete("/account", userController.deleteAccount);

module.exports = router;
