import mongoose from "mongoose";
import User from "./User.model.js";

const couponSchema = new mongoose.Schema(
  {
    // Basic Information
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: { type: String, required: true },
    description: String,

    // Notification Template
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
    value: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: 0 },
    minPurchaseAmount: { type: Number, default: 0 },

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
        cities: [{ type: mongoose.Schema.Types.ObjectId, ref: "CityArea" }],
        areas: [{ type: mongoose.Schema.Types.ObjectId }],
        stores: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
      },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      csvMobiles: [String],
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
      categories: [{ type: String, uppercase: true, trim: true }],
      brands: [{ type: String, uppercase: true, trim: true }],
      products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    },

    // Validity
    validFrom: { type: Date, required: true },
    neverExpires: { type: Boolean, default: false },
    validUntil: {
      type: Date,
      required: function () {
        return !this.neverExpires;
      },
      default: null,
    },

    // Redemption limits
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

    // Audit (optional but recommended)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =========================
   INDEXES
========================= */
couponSchema.index({ status: 1, validUntil: 1 });
couponSchema.index({ neverExpires: 1 });
// couponSchema.index({ code: 1 }, { unique: true });

/* =========================
   PRE SAVE
========================= */
couponSchema.pre("save", function () {
  // Auto-generate manual code if missing
  if (!this.manualCode) {
    this.manualCode = `RK-${this.code}-${Math.floor(100 + Math.random() * 900)}`;
  }

  // Auto-expire if past validUntil
  if (!this.neverExpires && this.validUntil && this.validUntil < new Date()) {
    this.status = "EXPIRED";
  }
});

/* =========================
   VIRTUALS
========================= */
couponSchema.virtual("isExpired").get(function () {
  if (this.neverExpires) return false;
  if (!this.validUntil) return false;
  return this.validUntil < Date.now();
});

couponSchema.virtual("isActive").get(function () {
  return (
    this.status === "ACTIVE" &&
    !this.isExpired &&
    this.currentRedemptions < this.maxRedemptions &&
    this.validFrom <= Date.now()
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
    if (this.maxDiscountAmount)
      discount = Math.min(discount, this.maxDiscountAmount);
  }

  return Math.round(discount);
};

/* =========================
   STATIC METHODS
========================= */
couponSchema.statics.findForUser = async function (userId, options = {}) {
  const user = await User.findById(userId);
  if (!user) return [];

  const now = new Date();

  const query = {
    status: "ACTIVE",
    validFrom: { $lte: now },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
    $or: [{ neverExpires: true }, { validUntil: { $gte: now } }],
  };

  if (options.targetingType) query["targeting.type"] = options.targetingType;

  return this.find(query);
};

/* =========================
   STATIC HELPER: EXPIRE COUPONS
   (Run in a cron job / script)
========================= */
couponSchema.statics.expireCoupons = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      neverExpires: false,
      validUntil: { $lt: now },
      status: { $ne: "EXPIRED" },
    },
    { $set: { status: "EXPIRED" } },
  );
  return result.modifiedCount;
};

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
