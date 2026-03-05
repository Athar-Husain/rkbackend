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
    description: {
      type: String,
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },

    bannerImage: {
      type: String,
      required: true,
      trim: true,
    },

    thumbnailImage: {
      type: String,
      trim: true,
    },

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
      categories: [{ type: String, trim: true }],
      brands: [{ type: String, trim: true }],
    },

    /* =========================
       VALIDITY
    ========================= */
    validFrom: {
      type: Date,
      required: true,
    },

    validUntil: {
      type: Date,
      required: true,
    },

    /* =========================
       DISPLAY
    ========================= */
    displayOrder: {
      type: Number,
      default: 0,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: Number,
      default: 1,
    },

    /* =========================
       ANALYTICS
    ========================= */
    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },

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
promotionSchema.index({ "targeting.users": 1 });
promotionSchema.index({ "targeting.geographic.cities": 1 });
promotionSchema.index({ "targeting.segments": 1 });

/* =====================================================
   PRE SAVE
===================================================== */

promotionSchema.pre("save", function (next) {
  // Auto swap if dates are reversed
  if (this.validFrom > this.validUntil) {
    const temp = this.validFrom;
    this.validFrom = this.validUntil;
    this.validUntil = temp;
  }

  // Auto mark expired
  if (this.validUntil < new Date()) {
    this.status = "EXPIRED";
  }

  next();
});

/* =====================================================
   VIRTUALS
===================================================== */

promotionSchema.virtual("isExpired").get(function () {
  return this.validUntil < new Date();
});

promotionSchema.virtual("isUpcoming").get(function () {
  return this.validFrom > new Date();
});

promotionSchema.virtual("isActive").get(function () {
  const now = new Date();

  return (
    this.status === "ACTIVE" && this.validFrom <= now && this.validUntil >= now
  );
});

/* =====================================================
   METHODS (ANALYTICS ONLY)
===================================================== */

promotionSchema.methods.recordImpression = function () {
  this.impressions += 1;
  return this.save();
};

promotionSchema.methods.recordClick = function () {
  this.clicks += 1;
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
  };

  if (featured) {
    baseQuery.featured = true;
  }

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
