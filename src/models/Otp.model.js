import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ["email", "mobile"],
      required: true,
    },
    otp: {
      type: String,
      required: true,
      select: false,
    },
    purpose: {
      type: String,
      required: true,
      enum: [
        "SIGNUP",
        "LOGIN",
        "PASSWORD_RESET",
        "EMAIL_VERIFICATION",
        "MOBILE_VERIFICATION",
      ],
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    metadata: {
      ip: String,
      userAgent: String,
      deviceId: String,
      mobile: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* ---------------- INDEXES ---------------- */
otpSchema.index({ identifier: 1, purpose: 1, verified: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ createdAt: 1 });

/* ---------------- VIRTUALS ---------------- */
otpSchema.virtual("isExpired").get(function () {
  return Date.now() > this.expiresAt;
});

otpSchema.virtual("isMaxAttemptsReached").get(function () {
  return this.attempts >= 5;
});

/* ---------------- PRE-SAVE HOOK ---------------- */
otpSchema.pre("save", async function () {
  // Only hash OTP if it's modified
  if (!this.isModified("otp")) return;

  const salt = await bcrypt.genSalt(10);
  this.otp = await bcrypt.hash(this.otp, salt);
});

/* ---------------- METHODS ---------------- */
otpSchema.methods.compareOTP = async function (candidateOTP) {
  return bcrypt.compare(candidateOTP, this.otp);
};

otpSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  return this.save();
};

otpSchema.methods.incrementRetryCount = async function () {
  this.retryCount += 1;
  return this.save();
};

/* ---------------- STATICS ---------------- */
otpSchema.statics.cleanupOldOTPs = async function (identifier, purpose) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await this.deleteMany({
    identifier,
    purpose,
    createdAt: { $lt: twentyFourHoursAgo },
    verified: false,
  });
};

otpSchema.statics.getRecentOTPCount = async function (
  identifier,
  purpose,
  hours = 24,
) {
  const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.countDocuments({
    identifier,
    purpose,
    createdAt: { $gte: timeAgo },
  });
};

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
