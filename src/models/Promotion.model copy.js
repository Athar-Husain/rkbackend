import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: [true, "Promotion title is required"],
    },
    description: String,
    shortDescription: String,

    // Image Information
    bannerImage: String,
    thumbnailImage: String,

    // Promotion Type
    type: {
      type: String,
      enum: ["DISCOUNT", "BOGO", "FREE_ITEM", "CASHBACK", "REWARD_POINTS"],
      required: true,
    },

    // Value
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxValue: Number, // For percentage discounts
    minValue: Number, // For minimum purchase requirements

    // Targeting Rules
    targeting: {
      type: {
        type: String,
        enum: ["ALL", "GEOGRAPHIC", "INDIVIDUAL", "SEGMENT", "PRODUCT_BASED"],
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

      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

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

      products: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      categories: [String],
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
    maxRedemptions: { type: Number, default: 1000 },
    currentRedemptions: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },

    // Display Settings
    displayOrder: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    priority: { type: Number, default: 1 }, // 1-5, higher is more important

    // Analytics
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "DELETED"],
      default: "DRAFT",
    },

    // Metadata
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

/* =========================
   PRE SAVE (NO next())
========================= */
promotionSchema.pre("save", async function () {
  if (this.validFrom > this.validUntil) {
    const temp = this.validFrom;
    this.validFrom = this.validUntil;
    this.validUntil = temp;
  }

  if (this.status === "ACTIVE" && this.validUntil < new Date()) {
    this.status = "EXPIRED";
  }
});

/* =========================
   VIRTUALS
========================= */
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
      if (this.value >= 1 && this.value < 100) {
        return `Upto ${this.value}% off`;
      } else if (this.value >= 100) {
        return `Upto ₹${this.value} off`;
      } else {
        return `${this.value}% off`;
      }
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

/* =========================
   METHODS
========================= */
promotionSchema.methods.recordImpression = function () {
  this.impressions += 1;
  return this.save();
};

promotionSchema.methods.recordClick = function () {
  this.clicks += 1;
  return this.save();
};

promotionSchema.methods.recordRedemption = function () {
  this.redemptions += 1;
  this.currentRedemptions += 1;
  return this.save();
};

/* =========================
   STATICS
========================= */
promotionSchema.statics.getActivePromotions = async function (options = {}) {
  const query = {
    status: "ACTIVE",
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  if (options.targetingType) {
    query["targeting.type"] = options.targetingType;
  }

  if (options.featured) {
    query.featured = true;
  }

  return this.find(query)
    .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
    .limit(options.limit || 20);
};

promotionSchema.statics.getFeaturedPromotions = async function (limit = 5) {
  return this.getActivePromotions({ featured: true, limit });
};

promotionSchema.statics.getPromotionsForUser = async function (userId, options = {}) {
  const User = mongoose.model("User");
  const user = await User.findById(userId).select("city area");

  if (!user) return [];

  const query = {
    status: "ACTIVE",
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] },
  };

  // Add geographic targeting if user has location
  if (user.city && user.area) {
    query["$or"] = [
      { "targeting.type": "ALL" },
      {
        "targeting.type": "GEOGRAPHIC",
        "targeting.geographic.cities": { $in: [user.city] },
        "targeting.geographic.areas": { $in: [user.area] },
      },
    ];
  } else {
    query["targeting.type"] = "ALL";
  }

  return this.find(query)
    .sort({ priority: -1, displayOrder: 1, createdAt: -1 })
    .limit(options.limit || 20);
};

const Promotion = mongoose.model("Promotion", promotionSchema);
export default Promotion;