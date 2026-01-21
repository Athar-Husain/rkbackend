const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protect, staffProtect } = require('../middleware/auth');

// User routes
router.use(protect);
router.get('/', couponController.getCoupons);
router.get('/:id', couponController.getCouponById);
router.post('/:id/claim', couponController.claimCoupon);

// Store staff routes
router.post('/validate', staffProtect, couponController.validateCoupon);
router.post('/redeem', staffProtect, couponController.redeemCoupon);

module.exports = router;