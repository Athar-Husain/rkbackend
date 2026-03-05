import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC INFORMATION
    ========================= */
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    /* =========================
       IMAGE
    ========================= */
    imageUrl: {
      type: String,
      required: [true, "Banner image URL is required"],
    },
    imageAlt: String,

    /* =========================
       TARGETING
    ========================= */
    targeting: {
      type: {
        type: String,
        enum: ["ALL", "GEOGRAPHIC", "INDIVIDUAL", "SEGMENT"],
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
          ],
        },
      ],
    },

    /* =========================
       ACTION
    ========================= */
    actionType: {
      type: String,
      enum: ["URL", "PRODUCT", "CATEGORY", "STORE", "COUPON"],
      required: true,
    },
    actionValue: String,

    /* =========================
       DISPLAY SETTINGS
    ========================= */
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    /* =========================
       ANALYTICS
    ========================= */
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    /* =========================
       METADATA
    ========================= */
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

bannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
bannerSchema.index({ "targeting.type": 1 });
bannerSchema.index({ displayOrder: 1 });

/* =====================================================
   PRE SAVE
===================================================== */

bannerSchema.pre("save", function () {
  if (this.startDate > this.endDate) {
    const temp = this.startDate;
    this.startDate = this.endDate;
    this.endDate = temp;
  }
});

/* =====================================================
   VIRTUALS
===================================================== */

bannerSchema.virtual("isExpired").get(function () {
  return this.endDate < new Date();
});

bannerSchema.virtual("isActiveNow").get(function () {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

/* =====================================================
   METHODS
===================================================== */

bannerSchema.methods.recordImpression = function () {
  this.impressions += 1;
  return this.save();
};

bannerSchema.methods.recordClick = function () {
  this.clicks += 1;
  return this.save();
};

/* =====================================================
   TARGETING MATCH HELPER
===================================================== */

const buildTargetingQuery = (user = null) => {
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

/**
 * Get active banners for public app
 */
bannerSchema.statics.getActiveBanners = async function ({
  user = null,
  limit = 10,
} = {}) {
  const now = new Date();

  const baseQuery = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  const targetingQuery = buildTargetingQuery(user);

  return this.find({
    ...baseQuery,
    ...targetingQuery,
  })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit);
};

bannerSchema.statics.getActiveBanners = async function (options = {}) {
  const query = {
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
  };

  if (options.targetingType) {
    query["targeting.type"] = options.targetingType;
  }

  return this.find(query).sort({ displayOrder: 1, createdAt: -1 });
};

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
