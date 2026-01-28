// services/otp.service.js
import OTP from "../models/Otp.model.js";
import { sendOTPEmail } from "./email.service.js";
import { sendOTPSMS } from "./sms.service.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Send OTP (Email + SMS)
 */
export const sendOTP = async ({ email, mobile, purpose }) => {
  if (!email && !mobile) {
    throw new Error("Email or mobile is required to send OTP");
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Remove previous OTPs for same purpose
  await OTP.deleteMany({
    purpose,
    ...(email && { email }),
    ...(mobile && { mobile }),
  });

  // Store OTP
  await OTP.create({
    email,
    mobile,
    otp,
    purpose,
    expiresAt,
  });

  // Send OTP
  if (email) await sendOTPEmail(email, otp);
  if (mobile) await sendOTPSMS(mobile, otp);

  return {
    success: true,
    message: "OTP sent successfully",
    ...(process.env.NODE_ENV === "development" && { otp }),
  };
};

/**
 * Verify OTP
 */
export const verifyOTP = async ({ email, mobile, otp, purpose }) => {
  const record = await OTP.findOne({
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
    ...(email && { email }),
    ...(mobile && { mobile }),
  }).select("+otp");

  if (!record) {
    return { success: false, error: "OTP expired or not found" };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await OTP.deleteOne({ _id: record._id });
    return { success: false, error: "Too many invalid attempts" };
  }

  const isValid = await record.matchOTP(otp);

  if (!isValid) {
    record.attempts += 1;
    await record.save();

    return { success: false, error: "Invalid OTP" };
  }

  record.verified = true;
  await record.save();

  return { success: true, message: "OTP verified successfully" };
};
