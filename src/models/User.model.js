// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid Indian mobile number"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    area: {
      type: String,
      required: [true, "Area is required"],
    },
    registrationStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },

    // Referral System
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Wallet (Simplified)
    walletBalance: {
      type: Number,
      default: 0,
    },

    // Device info for push notifications
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ["android", "ios", "web"],
        },
        lastActive: Date,
      },
    ],

    // Preferences
    preferences: {
      notifications: {
        type: Boolean,
        default: true,
      },
      smsAlerts: {
        type: Boolean,
        default: true,
      },
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Timestamps
    lastLogin: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Generate referral code before saving
userSchema.pre("save", async function (next) {
  if (!this.referralCode) {
    this.referralCode = await generateUniqueReferralCode();
  }
  next();
});

// Generate unique referral code
async function generateUniqueReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = "RK";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existingUser = await mongoose.models.User.findOne({
      referralCode: code,
    });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return code;
}

// Method to check if user has active coupons
userSchema.methods.hasActiveCoupons = async function () {
  const UserCoupon = mongoose.model("UserCoupon");
  const count = await UserCoupon.countDocuments({
    userId: this._id,
    status: "ACTIVE",
  });
  return count > 0;
};

// Method to get user's total savings
userSchema.methods.getTotalSavings = async function () {
  const Purchase = mongoose.model("Purchase");
  const result = await Purchase.aggregate([
    { $match: { userId: this._id, discount: { $gt: 0 } } },
    { $group: { _id: null, totalSavings: { $sum: "$discount" } } },
  ]);

  return result.length > 0 ? result[0].totalSavings : 0;
};

const User = mongoose.model("User", userSchema);
// module.exports = User;

export default User;
