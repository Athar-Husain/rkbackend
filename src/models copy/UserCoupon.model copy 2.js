import mongoose from "mongoose";
import qr from "qr-image";

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
      staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
      amountUsed: Number,
      notes: String,
    },

    // Validity (can override coupon validity)
    validFrom: Date,
    validUntil: Date,

    // Metadata
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =========================
   PRE SAVE (PRODUCTION GRADE)
========================= */
userCouponSchema.pre("save", async function () {
  // Logic to check if this is a first-time claim or a renewal of an expired record
  const isNewClaim = this.isNew;
  const isRenewing =
    this.isModified("status") && this.status === "ACTIVE" && !isNewClaim;

  /* ---------- UNIQUE CODE ---------- */
  // Regenerate code if it doesn't exist OR if we are re-activating an expired record
  if (!this.uniqueCode || isRenewing) {
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

      // Ensure the generated code is truly unique in the DB
      const existing = await mongoose.models.UserCoupon.findOne({
        uniqueCode: code,
      });

      if (!existing) {
        isUnique = true;
      }
    }
    this.uniqueCode = code;
  }

  /* ---------- QR CODE ---------- */
  // Generate QR if it's missing OR if the code/status changed
  if (!this.qrCodeData || isRenewing || this.isModified("uniqueCode")) {
    const payload = {
      userCouponId: this._id.toString(),
      userId: this.userId.toString(),
      couponId: this.couponId.toString(),
      uniqueCode: this.uniqueCode,
      timestamp: Date.now(),
    };

    // Encode payload
    this.qrCodeData = Buffer.from(JSON.stringify(payload)).toString("base64");

    try {
      const qr_png = qr.imageSync(this.qrCodeData, {
        type: "png",
        size: 10,
      });

      this.qrCodeImage = `data:image/png;base64,${qr_png.toString("base64")}`;
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }
});

/* =========================
   VIRTUALS
========================= */
userCouponSchema.virtual("isExpired").get(function () {
  return this.validUntil ? this.validUntil < new Date() : false;
});

userCouponSchema.virtual("isValid").get(function () {
  return this.status === "ACTIVE" && !this.isExpired;
});

/* =========================
   METHODS
========================= */
userCouponSchema.methods.redeem = async function (
  storeId,
  staffId,
  purchaseId,
  amountUsed,
  notes = "",
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

  const Coupon = mongoose.model("Coupon");
  await Coupon.findByIdAndUpdate(this.couponId, {
    $inc: { currentRedemptions: 1 },
  });

  return this.save();
};

/* =========================
   STATICS
========================= */
userCouponSchema.statics.validateQRCode = async function (qrData) {
  try {
    const decoded = Buffer.from(qrData, "base64").toString("utf8");
    const payload = JSON.parse(decoded);

    const userCoupon = await this.findById(payload.userCouponId)
      .populate("userId", "name mobile city area")
      .populate(
        "couponId",
        "code title type value minPurchaseAmount productRules",
      )
      .populate("redemption.storeId", "name location.address");

    if (!userCoupon) {
      return { valid: false, message: "Coupon not found" };
    }

    if (
      userCoupon.userId._id.toString() !== payload.userId ||
      userCoupon.couponId._id.toString() !== payload.couponId ||
      userCoupon.uniqueCode !== payload.uniqueCode
    ) {
      return { valid: false, message: "Invalid coupon data" };
    }

    if (userCoupon.status !== "ACTIVE") {
      return {
        valid: false,
        message: `Coupon has been ${userCoupon.status.toLowerCase()}`,
      };
    }

    if (userCoupon.isExpired) {
      return { valid: false, message: "Coupon has expired" };
    }

    return {
      valid: true,
      userCoupon,
      user: userCoupon.userId,
      coupon: userCoupon.couponId,
      discountAmount: userCoupon.couponId.value,
    };
  } catch (error) {
    console.error("QR validation error:", error);
    return { valid: false, message: "Invalid QR code format" };
  }
};

userCouponSchema.statics.validateManualCode2 = async function (code) {
  const userCoupon = await this.findOne({ uniqueCode: code })
    .populate("userId", "name mobile city area")
    .populate(
      "couponId",
      "code title type value minPurchaseAmount productRules",
    )
    .populate("redemption.storeId", "name location.address");

  if (!userCoupon) {
    return { valid: false, message: "Invalid coupon code" };
  }

  if (userCoupon.status !== "ACTIVE") {
    return {
      valid: false,
      message: `Coupon has been ${userCoupon.status.toLowerCase()}`,
    };
  }

  if (userCoupon.isExpired) {
    return { valid: false, message: "Coupon has expired" };
  }

  return {
    valid: true,
    userCoupon,
    user: userCoupon.userId,
    coupon: userCoupon.couponId,
    discountAmount: userCoupon.couponId.value,
  };
};

userCouponSchema.statics.validateManualCode = async function (
  code,
  currentPurchaseItems = [],
) {
  // Use a dynamic import or a reference to avoid circular dependency issues
  // if your targeting logic is in a separate file.
  const userCoupon = await this.findOne({ uniqueCode: code })
    .populate("userId")
    .populate("couponId");

  if (!userCoupon) return { valid: false, message: "Invalid code" };

  if (userCoupon.status !== "ACTIVE" || userCoupon.isExpired) {
    return { valid: false, message: "Coupon is not valid or has expired" };
  }

  // Ensure you import validateProductRules at the top of the file
  // or define it as a helper to keep this static method functional.
  return { valid: true, userCoupon };
};

const UserCoupon = mongoose.model("UserCoupon", userCouponSchema);
export default UserCoupon;
