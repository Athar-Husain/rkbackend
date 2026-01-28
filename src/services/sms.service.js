export const sendOTPSMS = async (mobile, otp) => {
  // TODO: Integrate SMS provider (Twilio, MSG91, etc.)
  // Example:
  // await smsProvider.send({
  //   to: mobile,
  //   message: `Your OTP is ${otp}. Valid for 10 minutes.`,
  // });

  console.log(`📲 SMS OTP to ${mobile}: ${otp}`);
};
