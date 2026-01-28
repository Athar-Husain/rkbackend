import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
      select: false, // never return OTP
    },
    purpose: {
      type: String,
      required: true,
      enum: ["SIGNUP", "LOGIN", "PASSWORD_RESET"],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

/* 🔥 Auto-delete expired OTPs */
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* 🔐 Hash OTP before save */
otpSchema.pre("save", async function () {
  if (!this.isModified("otp")) return;
  this.otp = await bcrypt.hash(this.otp, 10);
});

/* 🔍 Compare OTP */
otpSchema.methods.matchOTP = function (enteredOTP) {
  return bcrypt.compare(enteredOTP, this.otp);
};

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
