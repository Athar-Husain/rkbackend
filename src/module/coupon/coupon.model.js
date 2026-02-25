import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    value: { type: Number, required: true },
    maxDiscount: Number,

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    validFrom: Date,
    validUntil: Date,

    maxRedemptions: { type: Number, default: 0 },
    currentRedemptions: { type: Number, default: 0 },

    segments: [{ type: String }],

    stacking: {
      isStackable: { type: Boolean, default: false },
      stackGroup: { type: String, default: "DEFAULT" },
      priority: { type: Number, default: 1 },
    },

    isExclusive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

couponSchema.index({ status: 1, validUntil: 1 });

export default mongoose.model("Coupon", couponSchema);
