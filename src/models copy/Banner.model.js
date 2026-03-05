import mongoose from "mongoose";

const { Schema } = mongoose;

/* =====================================================
   SUB SCHEMAS
===================================================== */

const targetingSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["ALL", "GEOGRAPHIC", "INDIVIDUAL", "SEGMENT"],
      default: "ALL",
      index: true,
    },

    geographic: {
      cities: [{ type: Schema.Types.ObjectId, ref: "CityArea" }],
      areas: [{ type: Schema.Types.ObjectId }],
      stores: [{ type: Schema.Types.ObjectId, ref: "Store" }],
    },

    users: [{ type: Schema.Types.ObjectId, ref: "User" }],

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
  { _id: false },
);

/* =====================================================
   MAIN SCHEMA
===================================================== */

const bannerSchema = new Schema(
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
      trim: true,
      default: function () {
        return this.title;
      },
    },

    /* =========================
       TARGETING
    ========================= */
    targeting: {
      type: targetingSchema,
      default: () => ({ type: "ALL" }),
    },

    /* =========================
       ACTION
    ========================= */
    actionType: {
      type: String,
      enum: ["URL", "PRODUCT", "CATEGORY", "STORE", "COUPON", "NONE"],
      required: true,
      default: "NONE",
    },

    actionValue: {
      type: String,
      trim: true,
    },

    /* =========================
       DISPLAY SETTINGS
    ========================= */
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
      index: true,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    /* =========================
       ANALYTICS
    ========================= */
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },

    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* =========================
       METADATA
    ========================= */
    createdBy: {
      type: Schema.Types.ObjectId,
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
   COMPOUND INDEXES (FOR SCALE)
===================================================== */

bannerSchema.index({
  isActive: 1,
  startDate: 1,
  endDate: 1,
  displayOrder: 1,
});

/* =====================================================
   VALIDATION
===================================================== */

// bannerSchema.pre("validate", function (next) {
//   if (this.startDate && this.endDate && this.startDate > this.endDate) {
//     this.invalidate("endDate", "End date must be after start date");
//   }
//   next();
// });
bannerSchema.pre("validate", function () {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate("endDate", "End date must be after start date");
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
   INSTANCE METHODS (ATOMIC UPDATES)
===================================================== */

bannerSchema.methods.recordImpression = function () {
  return this.constructor.updateOne(
    { _id: this._id },
    { $inc: { impressions: 1 } },
  );
};

bannerSchema.methods.recordClick = function () {
  return this.constructor.updateOne({ _id: this._id }, { $inc: { clicks: 1 } });
};

/* =====================================================
   PRIVATE TARGETING BUILDER
===================================================== */

function buildTargetingQuery(user) {
  if (!user) {
    return { "targeting.type": "ALL" };
  }

  return {
    $or: [
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
    ],
  };
}

/* =====================================================
   STATICS
===================================================== */

/**
 * Fetch active banners with smart targeting
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
    .limit(limit)
    .lean();
};

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
