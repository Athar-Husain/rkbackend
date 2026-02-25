import mongoose from "mongoose";

const userCouponSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    uniqueCode: { type: String, unique: true },

    status: {
      type: String,
      enum: ["ACTIVE", "USED", "EXPIRED"],
      default: "ACTIVE",
    },

    redemption: {
      storeId: mongoose.Schema.Types.ObjectId,
      purchaseId: mongoose.Schema.Types.ObjectId,
      redeemedAt: Date,
    },
  },
  { timestamps: true },
);

userCouponSchema.index({ userId: 1, couponId: 1 });

export default mongoose.model("UserCoupon", userCouponSchema);
