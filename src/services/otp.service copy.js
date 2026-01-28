import OTP from "../models/Otp.model.js";
import { sendOTPEmail } from "./email.service.js";
import { sendOTPSMS } from "./sms.service.js";

const OTP_EXPIRY_MINUTES = 10;

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/** Send OTP */
export const sendOTP = async ({ email, mobile, purpose }) => {
  const otp = generateOTP();

  await OTP.deleteMany({ email, mobile, purpose });

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.create({
    email,
    mobile,
    otp,
    purpose,
    expiresAt,
  });

  if (email) await sendOTPEmail(email, otp);
  if (mobile) await sendOTPSMS(mobile, otp);

  return { success: true, message: "OTP sent successfully" };
};

/** Verify OTP */
export const verifyOTP = async ({ email, mobile, otp, purpose }) => {
  const record = await OTP.findOne({
    otp,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
    ...(email && { email }),
    ...(mobile && { mobile }),
  });

  if (!record) {
    return { success: false, error: "Invalid or expired OTP" };
  }

  record.verified = true;
  await record.save();

  return { success: true };
};
