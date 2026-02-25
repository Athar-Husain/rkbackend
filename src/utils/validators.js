import validator from "validator";

export const validateSignupInput2 = ({
  name,
  email,
  mobile,
  password,
  city_id,
  area_id,
}) => {
  if (!name || !email || !mobile || !password || !city_id || !area_id) {
    throw new Error("Missing required fields");
  }

  if (!validator.isEmail(email)) {
    throw new Error("Invalid email address");
  }

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid Indian mobile number");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
};

// Alternative: Return structured errors
export const validateSignupInput = (data) => {
  const errors = {
    name: [],
    email: [],
    mobile: [],
    password: [],
    city: [],
    area: [],
    referralCode: [],
  };

  let hasErrors = false;

  // Validate name
  if (!data.name || data.name.trim() === "") {
    errors.name.push("Name is required");
    hasErrors = true;
  } else if (data.name.trim().length < 2) {
    errors.name.push("Name must be at least 2 characters");
    hasErrors = true;
  }

  // Validate email
  if (!data.email || data.email.trim() === "") {
    errors.email.push("Email is required");
    hasErrors = true;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.email.push("Please enter a valid email address");
      hasErrors = true;
    }
  }

  // Validate mobile
  if (!data.mobile || data.mobile.trim() === "") {
    errors.mobile.push("Mobile number is required");
    hasErrors = true;
  } else {
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(data.mobile.trim())) {
      errors.mobile.push("Mobile must be a valid 10-digit Indian number");
      hasErrors = true;
    }
  }

  // Validate password
  if (!data.password || data.password.trim() === "") {
    errors.password.push("Password is required");
    hasErrors = true;
  } else if (data.password.length < 6) {
    errors.password.push("Password must be at least 6 characters");
    hasErrors = true;
  }

  // Validate city and area
  if (!data.city_id || data.city_id.trim() === "") {
    errors.city.push("City is required");
    hasErrors = true;
  }

  if (!data.area_id || data.area_id.trim() === "") {
    errors.area.push("Area is required");
    hasErrors = true;
  }

  // Validate referral code (if provided)
  if (data.referralCode && data.referralCode.trim() !== "") {
    const referralRegex = /^[A-Z0-9]{6,10}$/;
    if (!referralRegex.test(data.referralCode.trim().toUpperCase())) {
      errors.referralCode.push("Invalid referral code format");
      hasErrors = true;
    }
  }

  if (hasErrors) {
    // Filter out empty error arrays
    const filteredErrors = Object.fromEntries(
      Object.entries(errors).filter(([key, value]) => value.length > 0),
    );
    throw {
      name: "ValidationError",
      message: "Validation failed",
      errors: filteredErrors,
    };
  }
};

export const validateOTPVerifyInput = ({ emailOTP, mobileOTP, tempToken }) => {
  if (!emailOTP || !mobileOTP || !tempToken) {
    throw new Error("Email OTP, Mobile OTP and token are required");
  }
};

export const validateSigninInput = ({ emailOrMobile }) => {
  if (!emailOrMobile) {
    throw new Error("Email or mobile required");
  }

  if (
    !validator.isEmail(emailOrMobile) &&
    !/^[6-9]\d{9}$/.test(emailOrMobile)
  ) {
    throw new Error("Invalid email or mobile");
  }
};

export const validateResetPasswordInput = ({
  resetToken,
  emailOTP,
  mobileOTP,
  newPassword,
}) => {
  if (!resetToken || !emailOTP || !mobileOTP || !newPassword) {
    throw new Error("All fields are required");
  }

  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
};
