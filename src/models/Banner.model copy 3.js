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
    imageAlt: {
      type: String,
      default: function () {
        return this.title;
      },
    },

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
        areas: [{ type: mongoose.Schema.Types.ObjectId }], // Consider adding ref if exists
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
      enum: ["URL", "PRODUCT", "CATEGORY", "STORE", "COUPON", "NONE"],
      default: "NONE",
      required: true,
    },
    actionValue: String, // ID or URL depending on actionType

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
       ANALYTICS (Internal tracking)
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
   INDEXES
===================================================== */
bannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
bannerSchema.index({ "targeting.type": 1 });
bannerSchema.index({ displayOrder: 1, createdAt: -1 });

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
   PRE-SAVE VALIDATION
===================================================== */
bannerSchema.pre("validate", function (next) {
  if (this.startDate > this.endDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
  next();
});

/* =====================================================
   METHODS (Atomic updates for high traffic)
===================================================== */
bannerSchema.methods.recordImpression = function () {
  return this.model("Banner").updateOne(
    { _id: this._id },
    { $inc: { impressions: 1 } },
  );
};

bannerSchema.methods.recordClick = function () {
  return this.model("Banner").updateOne(
    { _id: this._id },
    { $inc: { clicks: 1 } },
  );
};

/* =====================================================
   STATICS (Merged logic)
===================================================== */
bannerSchema.statics.fetchActiveBanners = async function ({
  user = null,
  limit = 10,
} = {}) {
  const now = new Date();

  // Base Query: Must be Active and within Date Range
  const query = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  // Targeting Logic
  if (user) {
    query.$or = [
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
  } else {
    query["targeting.type"] = "ALL";
  }

  return this.find(query).sort({ displayOrder: 1, createdAt: -1 }).limit(limit);
};

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
