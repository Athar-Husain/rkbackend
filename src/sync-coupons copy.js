/**
 * SYNC SCRIPT: Run this once to fix the 3 vs 1 discrepancy
 */
export const syncCouponCounters = async (req, res, next) => {
  try {
    const results = [];
    const coupons = await Coupon.find({});

    for (const coupon of coupons) {
      // 1. Count the actual "USED" documents in the database
      const actualUsedCount = await UserCoupon.countDocuments({
        couponId: coupon._id,
        status: "USED",
      });

      // 2. Only update if there is a mismatch
      if (coupon.currentRedemptions !== actualUsedCount) {
        const oldVal = coupon.currentRedemptions;
        coupon.currentRedemptions = actualUsedCount;
        await coupon.save();

        results.push({
          code: coupon.code,
          fixed: true,
          previousValue: oldVal,
          newValue: actualUsedCount,
        });
      } else {
        results.push({ code: coupon.code, fixed: false });
      }
    }

    res.status(200).json({
      success: true,
      message: "Sync complete",
      details: results,
    });
  } catch (error) {
    next(error);
  }
};
