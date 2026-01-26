import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "referrerType", // Points to either User or Staff dynamically
    },
    referrerType: {
      type: String,
      required: true,
      enum: ["User", "Staff"], // Referrer can be User or Staff
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Status Tracking
    status: {
      type: String,
      enum: ["PENDING", "REGISTERED", "FIRST_PURCHASE", "COMPLETED", "EXPIRED"],
      default: "PENDING",
    },

    // Rewards
    rewards: {
      referrer: {
        type: {
          type: String,
          enum: ["COUPON", "WALLET_BALANCE", "CASHBACK"],
          default: "COUPON",
        },
        amount: { type: Number, default: 500 },
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
        status: {
          type: String,
          enum: ["PENDING", "ISSUED", "CLAIMED"],
          default: "PENDING",
        },
        issuedAt: Date,
        claimedAt: Date,
      },
      referred: {
        type: {
          type: String,
          enum: ["COUPON", "WALLET_BALANCE", "CASHBACK"],
          default: "COUPON",
        },
        amount: { type: Number, default: 300 },
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
        status: {
          type: String,
          enum: ["PENDING", "ISSUED", "CLAIMED"],
          default: "PENDING",
        },
        issuedAt: Date,
        claimedAt: Date,
      },
    },

    // Tracking Dates
    referralDate: { type: Date, default: Date.now },
    registrationDate: Date,
    firstPurchaseDate: Date,
    completionDate: Date,

    // Expiry
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  },
  { timestamps: true },
);

// --- Virtuals ---
referralSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date();
});
referralSchema.virtual("isActive").get(function () {
  return !this.isExpired && !["COMPLETED", "EXPIRED"].includes(this.status);
});

// --- Methods ---
referralSchema.methods.markAsRegistered = function () {
  this.status = "REGISTERED";
  this.registrationDate = new Date();
  return this.save();
};

referralSchema.methods.markAsFirstPurchase = async function (purchaseId) {
  const Purchase = mongoose.model("Purchase");
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new Error("Purchase not found");

  this.status = "FIRST_PURCHASE";
  this.firstPurchaseDate = purchase.createdAt;

  if (purchase.finalAmount >= 5000) {
    this.status = "COMPLETED";
    this.completionDate = new Date();
    await this.issueRewards();
  }
  return this.save();
};

referralSchema.methods.issueRewards = async function () {
  const Coupon = mongoose.model("Coupon");
  const UserCoupon = mongoose.model("UserCoupon");

  // Referrer coupon
  const referrerCoupon = new Coupon({
    code: `REF-${this.referrerType.toUpperCase()}-${this.referrerId.toString().substr(-6)}`,
    title: "Referral Bonus - ₹500 Off",
    description: "Reward for successful referral",
    type: "FIXED_AMOUNT",
    value: this.rewards.referrer.amount,
    minPurchaseAmount: 10000,
    targeting: { type: "INDIVIDUAL", users: [this.referrerId] },
    productRules: { type: "ALL_PRODUCTS" },
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    status: "ACTIVE",
  });
  await referrerCoupon.save();

  await new UserCoupon({
    userId: this.referrerId,
    couponId: referrerCoupon._id,
  }).save();
  this.rewards.referrer.couponId = referrerCoupon._id;
  this.rewards.referrer.status = "ISSUED";
  this.rewards.referrer.issuedAt = new Date();

  // Referred user coupon
  const referredCoupon = new Coupon({
    code: `REF-USER-${this.referredUserId.toString().substr(-6)}`,
    title: "Welcome Bonus - ₹300 Off",
    description: "Welcome reward for joining through referral",
    type: "FIXED_AMOUNT",
    value: this.rewards.referred.amount,
    minPurchaseAmount: 5000,
    targeting: { type: "INDIVIDUAL", users: [this.referredUserId] },
    productRules: { type: "ALL_PRODUCTS" },
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    status: "ACTIVE",
  });
  await referredCoupon.save();

  await new UserCoupon({
    userId: this.referredUserId,
    couponId: referredCoupon._id,
  }).save();
  this.rewards.referred.couponId = referredCoupon._id;
  this.rewards.referred.status = "ISSUED";
  this.rewards.referred.issuedAt = new Date();

  return this.save();
};

// --- Static Methods ---
referralSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        referrerId: mongoose.Types.ObjectId(userId),
        status: { $in: ["FIRST_PURCHASE", "COMPLETED"] },
      },
    },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        totalEarnings: { $sum: "$rewards.referrer.amount" },
        pendingEarnings: {
          $sum: {
            $cond: [
              { $eq: ["$rewards.referrer.status", "PENDING"] },
              "$rewards.referrer.amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  if (!stats.length)
    return { totalReferrals: 0, totalEarnings: 0, pendingEarnings: 0 };
  return stats[0];
};

const Referral = mongoose.model("Referral", referralSchema);
export default Referral;
