import mongoose from "mongoose";
import User from "./User.model.js";

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

    // Notification Template (Stored for auto-triggering new users)
    notification: {
      title: { type: String, default: "" },
      body: { type: String, default: "" },
    },

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
    maxDiscountAmount: { type: Number, default: 0 },
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

      geographic: {
        cities: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CityArea",
          },
        ],
        areas: [
          {
            type: mongoose.Schema.Types.ObjectId,
            // Note: No ref here because Areas are sub-documents in CityArea
          },
        ],
        stores: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
          },
        ],
      },
      // geographic: {
      //   cities: [String],
      //   areas: [String],
      //   stores: [
      //     {
      //       type: mongoose.Schema.Types.ObjectId,
      //       ref: "Store",
      //     },
      //   ],
      // },

      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      csvMobiles: [String], // Storing raw list for audit

      purchaseHistory: {
        minPurchases: { type: Number, default: 0 },
        categories: [String],
        minTotalSpent: { type: Number, default: 0 },
        timeFrame: {
          type: String,
          enum: ["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS", "ALL_TIME"],
        },
      },

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
      categories: [
        {
          type: String,
          uppercase: true,
          trim: true,
        },
      ],
      brands: [
        {
          type: String,
          uppercase: true,
          trim: true,
        },
      ],
      products: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
    },

    // Validity
    validFrom: {
      type: Date,
      required: true,
    },

    validUntil: {
      type: Date,
      required: function () {
        return !this.neverExpires;
      },
      default: null,
    },

    neverExpires: {
      type: Boolean,
      default: false,
    },
    maxRedemptions: { type: Number, default: 1000 },
    currentRedemptions: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },

    // Codes
    qrCodeData: String,
    manualCode: String,

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "DELETED"],
      default: "DRAFT",
    },

    // Metadata
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    // },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =========================
   PRE SAVE (NO next())
========================= */
couponSchema.pre("save", async function () {
  if (!this.manualCode) {
    this.manualCode = `RK-${this.code}-${Math.floor(
      100 + Math.random() * 900,
    )}`;
  }

  if (
    this.validUntil &&
    this.validUntil < new Date() &&
    this.status === "ACTIVE"
  ) {
    this.status = "EXPIRED";
  }
});

/* =========================
   VIRTUALS
========================= */
couponSchema.virtual("isExpired").get(function () {
  return this.validUntil < new Date();
});

couponSchema.virtual("isActive").get(function () {
  return (
    this.status === "ACTIVE" &&
    !this.isExpired &&
    this.currentRedemptions < this.maxRedemptions
  );
});

/* =========================
   METHODS
========================= */
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

/* =========================
   STATICS
========================= */
couponSchema.statics.findForUser = async function (userId, options = {}) {
  // const User = mongoose.model("User");
  const user = await User.findById(userId);
  if (!user) return [];

  const query = {
    status: "ACTIVE",
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  if (options.targetingType) {
    query["targeting.type"] = options.targetingType;
  }

  return this.find(query);
};

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
