import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: [true, "Banner title is required"],
    },
    description: String,

    // Image Information
    imageUrl: {
      type: String,
      required: [true, "Banner image URL is required"],
    },
    imageAlt: String,

    // Targeting Rules
    targeting: {
      type: {
        type: String,
        enum: ["ALL", "GEOGRAPHIC", "INDIVIDUAL", "SEGMENT"],
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
          ],
        },
      ],
    },

    // Action Information
    actionType: {
      type: String,
      enum: ["URL", "PRODUCT", "CATEGORY", "STORE", "COUPON"],
      required: true,
    },
    actionValue: String, // URL or product/category/store/coupon ID

    // Display Settings
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

    // Analytics
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

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
bannerSchema.pre("save", async function () {
  if (this.startDate > this.endDate) {
    const temp = this.startDate;
    this.startDate = this.endDate;
    this.endDate = temp;
  }
});

/* =========================
   VIRTUALS
========================= */
bannerSchema.virtual("isExpired").get(function () {
  return this.endDate < new Date();
});

bannerSchema.virtual("isActiveNow").get(function () {
  const now = new Date();
  return this.isActive && !this.isExpired && now >= this.startDate && now <= this.endDate;
});

/* =========================
   METHODS
========================= */
bannerSchema.methods.recordImpression = function () {
  this.impressions += 1;
  return this.save();
};

bannerSchema.methods.recordClick = function () {
  this.clicks += 1;
  return this.save();
};

/* =========================
   STATICS
========================= */
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