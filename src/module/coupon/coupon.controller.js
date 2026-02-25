import { getEligibleCouponsForUser, redeemCoupon } from "./coupon.service.js";

export const fetchEligibleCoupons = async (req, res) => {
  try {
    const { cartAmount } = req.body;

    const user = req.user;

    const userStats = {
      purchaseCount: user.purchaseCount || 0,
      lastPurchase: user.lastPurchase || null,
    };

    const result = await getEligibleCouponsForUser(user, userStats, cartAmount);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const redeemCouponController = async (req, res) => {
  try {
    const { uniqueCode, storeId, purchaseId } = req.body;

    const result = await redeemCoupon({
      userId: req.user._id,
      uniqueCode,
      storeId,
      purchaseId,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
