const mongoose = require("mongoose");
const qr = require("qr-image");

const userCouponSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },

    // Unique identifiers for this user-coupon pair
    uniqueCode: {
      type: String,
      unique: true,
      uppercase: true,
    },
    qrCodeImage: String, // Base64 or URL to QR image
    qrCodeData: String, // Encrypted data for validation

    // Status
    status: {
      type: String,
      enum: ["ACTIVE", "USED", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
    },

    // Redemption details
    redemption: {
      storeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
      },
      redeemedAt: Date,
      purchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Purchase",
      },
      staffId: String, // Staff username who processed
      amountUsed: Number, // Actual discount applied
      notes: String,
    },

    // Validity (inherited from coupon but can be overridden)
    validFrom: Date,
    validUntil: Date,

    // Metadata
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate unique code and QR before saving
userCouponSchema.pre("save", async function (next) {
  if (!this.uniqueCode) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    let isUnique = false;

    while (!isUnique) {
      code = "RK-";
      for (let i = 0; i < 3; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code += "-";
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await mongoose.models.UserCoupon.findOne({
        uniqueCode: code,
      });
      if (!existing) {
        isUnique = true;
      }
    }

    this.uniqueCode = code;
  }

  // Generate QR code data
  if (!this.qrCodeData) {
    const payload = {
      userCouponId: this._id.toString(),
      userId: this.userId.toString(),
      couponId: this.couponId.toString(),
      uniqueCode: this.uniqueCode,
      timestamp: Date.now(),
    };

    // Encrypt payload (simplified - in production use proper encryption)
    this.qrCodeData = Buffer.from(JSON.stringify(payload)).toString("base64");

    // Generate QR code image (Base64)
    try {
      const qr_png = qr.imageSync(this.qrCodeData, { type: "png", size: 10 });
      this.qrCodeImage = `data:image/png;base64,${qr_png.toString("base64")}`;
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  next();
});

// Virtual for isExpired
userCouponSchema.virtual("isExpired").get(function () {
  if (this.validUntil) {
    return this.validUntil < new Date();
  }
  return false;
});

// Virtual for isValid (can be used)
userCouponSchema.virtual("isValid").get(function () {
  return this.status === "ACTIVE" && !this.isExpired;
});

// Method to redeem coupon
userCouponSchema.methods.redeem = async function (
  storeId,
  staffId,
  purchaseId,
  amountUsed,
  notes = ""
) {
  if (this.status !== "ACTIVE") {
    throw new Error("Coupon is not active");
  }

  if (this.isExpired) {
    throw new Error("Coupon has expired");
  }

  this.status = "USED";
  this.redemption = {
    storeId,
    staffId,
    purchaseId,
    amountUsed,
    redeemedAt: new Date(),
    notes,
  };

  // Increment coupon redemption count
  const Coupon = mongoose.model("Coupon");
  await Coupon.findByIdAndUpdate(this.couponId, {
    $inc: { currentRedemptions: 1 },
  });

  return this.save();
};

// Static method to validate QR code
userCouponSchema.statics.validateQRCode = async function (qrData) {
  try {
    // Decode QR data
    const decoded = Buffer.from(qrData, "base64").toString("utf8");
    const payload = JSON.parse(decoded);

    // Find user coupon
    const userCoupon = await this.findById(payload.userCouponId)
      .populate("userId", "name mobile city area")
      .populate(
        "couponId",
        "code title type value minPurchaseAmount productRules"
      )
      .populate("redemption.storeId", "name location.address");

    if (!userCoupon) {
      return { valid: false, message: "Coupon not found" };
    }

    // Validate payload matches
    if (
      userCoupon.userId._id.toString() !== payload.userId ||
      userCoupon.couponId._id.toString() !== payload.couponId ||
      userCoupon.uniqueCode !== payload.uniqueCode
    ) {
      return { valid: false, message: "Invalid coupon data" };
    }

    // Check status
    if (userCoupon.status !== "ACTIVE") {
      return {
        valid: false,
        message: `Coupon has been ${userCoupon.status.toLowerCase()}`,
      };
    }

    // Check expiry
    if (userCoupon.isExpired) {
      return { valid: false, message: "Coupon has expired" };
    }

    return {
      valid: true,
      userCoupon: userCoupon,
      user: userCoupon.userId,
      coupon: userCoupon.couponId,
      discountAmount: userCoupon.couponId.value,
    };
  } catch (error) {
    console.error("QR validation error:", error);
    return { valid: false, message: "Invalid QR code format" };
  }
};

// Static method to validate manual code
userCouponSchema.statics.validateManualCode = async function (code) {
  const userCoupon = await this.findOne({ uniqueCode: code })
    .populate("userId", "name mobile city area")
    .populate(
      "couponId",
      "code title type value minPurchaseAmount productRules"
    )
    .populate("redemption.storeId", "name location.address");

  if (!userCoupon) {
    return { valid: false, message: "Invalid coupon code" };
  }

  // Check status
  if (userCoupon.status !== "ACTIVE") {
    return {
      valid: false,
      message: `Coupon has been ${userCoupon.status.toLowerCase()}`,
    };
  }

  // Check expiry
  if (userCoupon.isExpired) {
    return { valid: false, message: "Coupon has expired" };
  }

  return {
    valid: true,
    userCoupon: userCoupon,
    user: userCoupon.userId,
    coupon: userCoupon.couponId,
    discountAmount: userCoupon.couponId.value,
  };
};

const UserCoupon = mongoose.model("UserCoupon", userCouponSchema);
module.exports = UserCoupon;
