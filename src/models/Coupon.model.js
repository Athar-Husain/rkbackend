// const mongoose = require("mongoose");

import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    // Basic Information
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Coupon title is required"],
    },
    description: String,

    // Value
    type: {
      type: String,
      enum: ["FIXED_AMOUNT", "PERCENTAGE", "FREE_ITEM"],
      default: "FIXED_AMOUNT",
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: Number, // For percentage coupons
    minPurchaseAmount: {
      type: Number,
      default: 0,
    },

    // Targeting Rules
    targeting: {
      type: {
        type: String,
        enum: [
          "ALL",
          "GEOGRAPHIC",
          "INDIVIDUAL",
          "PURCHASE_HISTORY",
          "REFERRAL",
        ],
        default: "ALL",
      },

      // Geographic Targeting
      geographic: {
        cities: [String],
        areas: [String],
        stores: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
          },
        ],
      },

      // Individual Targeting
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      // Purchase History Targeting
      purchaseHistory: {
        minPurchases: {
          type: Number,
          default: 0,
        },
        categories: [String],
        minTotalSpent: {
          type: Number,
          default: 0,
        },
        timeFrame: {
          type: String,
          enum: ["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS", "ALL_TIME"],
        },
      },

      // Customer Segments
      segments: [
        {
          type: String,
          enum: [
            "NEW_USER",
            "LOYAL_CUSTOMER",
            "INACTIVE_30_DAYS",
            "FREQUENT_BUYER",
          ],
        },
      ],
    },

    // Product Restrictions
    productRules: {
      type: {
        type: String,
        enum: ["ALL_PRODUCTS", "CATEGORY", "PRODUCT", "BRAND"],
        default: "ALL_PRODUCTS",
      },
      categories: [String],
      products: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      brands: [String],
    },

    // Validity
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },

    // Usage Limits
    maxRedemptions: {
      type: Number,
      default: 1000,
    },
    currentRedemptions: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },

    // QR Code & Manual Code
    qrCodeData: String, // Encrypted data for QR
    manualCode: String, // Simple code for manual entry

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "DELETED"],
      default: "DRAFT",
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Generate manual code before saving
couponSchema.pre("save", function (next) {
  if (!this.manualCode) {
    this.manualCode = `RK-${this.code}-${Math.floor(
      100 + Math.random() * 900,
    )}`;
  }

  // Check if coupon is expired
  if (
    this.validUntil &&
    this.validUntil < new Date() &&
    this.status === "ACTIVE"
  ) {
    this.status = "EXPIRED";
  }

  next();
});

// Virtual for isExpired
couponSchema.virtual("isExpired").get(function () {
  return this.validUntil < new Date();
});

// Virtual for isActive
couponSchema.virtual("isActive").get(function () {
  return (
    this.status === "ACTIVE" &&
    !this.isExpired &&
    this.currentRedemptions < this.maxRedemptions
  );
});

// Method to check if user is eligible
couponSchema.methods.isUserEligible = async function (
  userId,
  purchaseAmount = 0,
) {
  const User = mongoose.model("User");
  const UserCoupon = mongoose.model("UserCoupon");
  const Purchase = mongoose.model("Purchase");

  const user = await User.findById(userId);
  if (!user) return { eligible: false, reason: "User not found" };

  // Check per user limit
  const userCouponCount = await UserCoupon.countDocuments({
    couponId: this._id,
    userId: userId,
    status: { $in: ["ACTIVE", "USED"] },
  });

  if (userCouponCount >= this.perUserLimit) {
    return { eligible: false, reason: "Coupon limit reached" };
  }

  // Check min purchase amount
  if (purchaseAmount < this.minPurchaseAmount) {
    return {
      eligible: false,
      reason: `Minimum purchase of ₹${this.minPurchaseAmount} required`,
    };
  }

  // Check geographic targeting
  if (this.targeting.type === "GEOGRAPHIC" && this.targeting.geographic) {
    const geo = this.targeting.geographic;

    if (geo.cities && geo.cities.length > 0) {
      if (
        !geo.cities.some(
          (city) => city.toLowerCase() === user.city.toLowerCase(),
        )
      ) {
        return { eligible: false, reason: "Coupon not available in your city" };
      }
    }

    if (geo.areas && geo.areas.length > 0) {
      if (
        !geo.areas.some(
          (area) => area.toLowerCase() === user.area.toLowerCase(),
        )
      ) {
        return { eligible: false, reason: "Coupon not available in your area" };
      }
    }
  }

  // Check individual targeting
  if (this.targeting.type === "INDIVIDUAL" && this.targeting.users) {
    if (
      !this.targeting.users.some((id) => id.toString() === userId.toString())
    ) {
      return { eligible: false, reason: "Coupon not assigned to you" };
    }
  }

  // Check purchase history targeting
  if (
    this.targeting.type === "PURCHASE_HISTORY" &&
    this.targeting.purchaseHistory
  ) {
    const rules = this.targeting.purchaseHistory;
    const query = { userId: userId };

    // Time frame filter
    if (rules.timeFrame) {
      const now = new Date();
      let startDate = new Date();

      switch (rules.timeFrame) {
        case "LAST_7_DAYS":
          startDate.setDate(now.getDate() - 7);
          break;
        case "LAST_30_DAYS":
          startDate.setDate(now.getDate() - 30);
          break;
        case "LAST_90_DAYS":
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    // Category filter
    if (rules.categories && rules.categories.length > 0) {
      query["items.category"] = { $in: rules.categories };
    }

    const purchases = await Purchase.find(query);

    if (purchases.length < rules.minPurchases) {
      return { eligible: false, reason: "Purchase requirements not met" };
    }

    const totalSpent = purchases.reduce(
      (sum, purchase) => sum + purchase.finalAmount,
      0,
    );
    if (totalSpent < rules.minTotalSpent) {
      return { eligible: false, reason: "Minimum spend requirement not met" };
    }
  }

  // Check segments
  if (this.targeting.segments && this.targeting.segments.length > 0) {
    // Implement segment checking logic here
    // This would require additional user analytics
  }

  return { eligible: true, reason: "User is eligible" };
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function (purchaseAmount) {
  let discount = 0;

  if (this.type === "FIXED_AMOUNT") {
    discount = Math.min(this.value, purchaseAmount);
  } else if (this.type === "PERCENTAGE") {
    discount = (purchaseAmount * this.value) / 100;
    if (this.maxDiscount) {
      discount = Math.min(discount, this.maxDiscount);
    }
  }

  return Math.round(discount);
};

// Static method to find coupons for user
couponSchema.statics.findForUser = async function (userId, options = {}) {
  const User = mongoose.model("User");
  const user = await User.findById(userId);

  if (!user) return [];

  const query = {
    status: "ACTIVE",
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    currentRedemptions: { $lt: "$maxRedemptions" },
  };

  // Filter by targeting type
  if (options.targetingType) {
    query["targeting.type"] = options.targetingType;
  }

  const coupons = await this.find(query);

  // Filter coupons based on user eligibility
  const eligibleCoupons = [];

  for (const coupon of coupons) {
    const eligibility = await coupon.isUserEligible(userId);
    if (eligibility.eligible) {
      eligibleCoupons.push(coupon);
    }
  }

  return eligibleCoupons;
};

const Coupon = mongoose.model("Coupon", couponSchema);
// module.exports = Coupon;

export default Coupon;
