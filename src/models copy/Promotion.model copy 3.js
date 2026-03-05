import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC INFO
    ========================= */
    title: {
      type: String,
      required: [true, "Promotion title is required"],
      trim: true,
    },
    description: String,
    shortDescription: String,

    bannerImage: {
      type: String,
      required: true,
    },
    thumbnailImage: String,

    /* =========================
       PROMOTION TYPE
    ========================= */
    type: {
      type: String,
      enum: ["DISCOUNT", "BOGO", "FREE_ITEM", "CASHBACK", "REWARD_POINTS"],
      // required: true,
    },

    value: {
      type: Number,
      // required: true,
      min: 0,
    },
    maxValue: Number,
    minValue: Number,

    /* =========================
       TARGETING
    ========================= */
    targeting: {
      type: {
        type: String,
        enum: ["ALL", "GEOGRAPHIC", "INDIVIDUAL", "SEGMENT", "PRODUCT_BASED"],
        default: "ALL",
      },

      geographic: {
        cities: [{ type: mongoose.Schema.Types.ObjectId, ref: "CityArea" }],
        areas: [{ type: mongoose.Schema.Types.ObjectId }],
        stores: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
      },

      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

      segments: [
        {
          type: String,
          enum: [
            "NEW_USER",
            "LOYAL_CUSTOMER",
            "INACTIVE_30_DAYS",
            "FREQUENT_BUYER",
            "HIGH_VALUE_CUSTOMER",
          ],
        },
      ],

      products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      categories: [String],
      brands: [String],
    },

    /* =========================
       VALIDITY
    ========================= */
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },

    /* =========================
       USAGE
    ========================= */
    maxRedemptions: { type: Number, default: 1000 },
    currentRedemptions: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },

    /* =========================
       DISPLAY
    ========================= */
    displayOrder: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    priority: { type: Number, default: 1 },

    /* =========================
       ANALYTICS
    ========================= */
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },

    /* =========================
       STATUS
    ========================= */
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "DELETED"],
      default: "DRAFT",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =====================================================
   INDEXES (IMPORTANT FOR SCALE)
===================================================== */

promotionSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
promotionSchema.index({ featured: 1 });
promotionSchema.index({ priority: -1, displayOrder: 1 });
promotionSchema.index({ "targeting.type": 1 });

/* =====================================================
   PRE SAVE
===================================================== */

promotionSchema.pre("save", function () {
  if (this.validFrom > this.validUntil) {
    const temp = this.validFrom;
    this.validFrom = this.validUntil;
    this.validUntil = temp;
  }

  if (this.status === "ACTIVE" && this.validUntil < new Date()) {
    this.status = "EXPIRED";
  }
});

/* =====================================================
   VIRTUALS
===================================================== */

promotionSchema.virtual("isExpired").get(function () {
  return this.validUntil < new Date();
});

promotionSchema.virtual("isActive").get(function () {
  return (
    this.status === "ACTIVE" &&
    !this.isExpired &&
    this.currentRedemptions < this.maxRedemptions
  );
});

promotionSchema.virtual("discountMessage").get(function () {
  switch (this.type) {
    case "DISCOUNT":
      return this.value < 100
        ? `Upto ${this.value}% off`
        : `Upto ₹${this.value} off`;
    case "BOGO":
      return "Buy 1 Get 1 Free";
    case "FREE_ITEM":
      return "Free Item with Purchase";
    case "CASHBACK":
      return `Get ₹${this.value} cashback`;
    case "REWARD_POINTS":
      return `Earn ${this.value} reward points`;
    default:
      return "Special Offer";
  }
});

/* =====================================================
   METHODS
===================================================== */

promotionSchema.methods.recordImpression = function () {
  this.impressions += 1;
  return this.save();
};

promotionSchema.methods.recordClick = function () {
  this.clicks += 1;
  return this.save();
};

promotionSchema.methods.recordRedemption = function () {
  if (this.currentRedemptions >= this.maxRedemptions) return this;
  this.redemptions += 1;
  this.currentRedemptions += 1;
  return this.save();
};

/* =====================================================
   TARGETING HELPER
===================================================== */

const buildPromotionTargetingQuery = (user = null) => {
  if (!user) {
    return { "targeting.type": "ALL" };
  }

  const conditions = [
    { "targeting.type": "ALL" },

    {
      $and: [
        { "targeting.type": "INDIVIDUAL" },
        { "targeting.users": user._id },
      ],
    },

    {
      $and: [
        { "targeting.type": "GEOGRAPHIC" },
        {
          $or: [
            { "targeting.geographic.cities": user.city },
            { "targeting.geographic.areas": user.area },
            { "targeting.geographic.stores": user.store },
          ],
        },
      ],
    },

    {
      $and: [
        { "targeting.type": "SEGMENT" },
        { "targeting.segments": { $in: user.segments || [] } },
      ],
    },
  ];

  return { $or: conditions };
};

/* =====================================================
   STATICS
===================================================== */

promotionSchema.statics.getActivePromotions = async function ({
  user = null,
  featured = false,
  limit = 20,
} = {}) {
  const now = new Date();

  const baseQuery = {
    status: "ACTIVE",
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  if (featured) baseQuery.featured = true;

  const targetingQuery = buildPromotionTargetingQuery(user);

  return this.find({
    ...baseQuery,
    ...targetingQuery,
  })
    .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

promotionSchema.statics.getFeaturedPromotions = function (limit = 5) {
  return this.getActivePromotions({ featured: true, limit });
};

promotionSchema.statics.getPromotionsForUser = function (user, options = {}) {
  return this.getActivePromotions({
    user,
    limit: options.limit || 20,
  });
};

const Promotion = mongoose.model("Promotion", promotionSchema);
export default Promotion;
