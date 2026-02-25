import mongoose from "mongoose";
import Coupon from "./coupon.model.js";
import UserCoupon from "./userCoupon.model.js";
import { evaluateSegments } from "./segment.engine.js";
import { resolveStacking } from "./stacking.engine.js";
import { applyCouponsToAmount } from "./pricing.engine.js";
import { checkCouponEligibility } from "./coupon.engine.js";

export const getEligibleCouponsForUser = async (
  user,
  userStats,
  cartAmount,
) => {
  const coupons = await Coupon.find({
    status: "ACTIVE",
  }).lean();

  const segments = evaluateSegments(userStats);

  const eligible = coupons.filter((coupon) =>
    checkCouponEligibility({ coupon, userSegments: segments }),
  );

  const stacked = resolveStacking(eligible);

  const pricing = applyCouponsToAmount(cartAmount, stacked);

  return {
    appliedCoupons: stacked,
    pricing,
  };
};

export const redeemCoupon = async ({
  userId,
  uniqueCode,
  storeId,
  purchaseId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userCoupon = await UserCoupon.findOne({
      userId,
      uniqueCode,
      status: "ACTIVE",
    })
      .populate("couponId")
      .session(session);

    if (!userCoupon) {
      throw new Error("Invalid coupon");
    }

    const master = await Coupon.findOneAndUpdate(
      {
        _id: userCoupon.couponId._id,
        currentRedemptions: {
          $lt: userCoupon.couponId.maxRedemptions,
        },
      },
      { $inc: { currentRedemptions: 1 } },
      { new: true, session },
    );

    if (!master) {
      throw new Error("Redemption limit reached");
    }

    userCoupon.status = "USED";
    userCoupon.redemption = {
      storeId,
      purchaseId,
      redeemedAt: new Date(),
    };

    await userCoupon.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
