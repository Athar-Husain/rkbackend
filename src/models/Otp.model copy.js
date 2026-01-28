import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: String,
    mobile: String,
    otp: String,
    purpose: {
      type: String,
      enum: ["SIGNUP", "LOGIN", "PASSWORD_RESET"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("OTP", otpSchema);
