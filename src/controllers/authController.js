import User from "../models/User.model.js";
import Referral from "../models/Referral.model.js";
import { sendOTP, verifyOTP } from "../services/otp.service.js";
import NotificationService from "../services/notificationService.js";
import { generateToken } from "../middleware/auth.js";

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

/**
 * Normalize frontend payload → backend fields
 * Frontend naming can change freely later
 */
const normalizeSignupPayload = (body) => ({
  name: body.name?.trim(),
  email: body.email?.toLowerCase(),
  password: body.password,
  mobile: body.phone, // phone → mobile
  city: body.city_id, // city_id → city
  area: body.area_id, // area_id → area
  referralCode: body.referralCode,
});

/* -------------------------------------------------------------------------- */
/*                              AUTH FLOWS                                    */
/* -------------------------------------------------------------------------- */

/**
 * @desc    Send OTP for Signup (Email + SMS)
 * @route   POST /api/auth/signup/send-otp
 * @access  Public
 */
export const sendSignupOTP = async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Email and phone number are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { mobile: phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Account already exists. Please login instead.",
      });
    }

    await sendOTP({
      email,
      mobile: phone,
      purpose: "SIGNUP",
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Signup OTP (Email or Mobile)
 * @route   POST /api/auth/signup/verify-otp
 * @access  Public
 */
export const verifySignupOTP = async (req, res, next) => {
  try {
    const { email, phone, otp } = req.body;

    if ((!email && !phone) || !otp) {
      return res.status(400).json({
        success: false,
        message: "OTP and email or phone are required",
      });
    }

    const result = await verifyOTP({
      email,
      mobile: phone,
      otp,
      purpose: "SIGNUP",
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete Signup after OTP verification
 * @route   POST /api/auth/signup
 * @access  Public
 */
export const signup = async (req, res, next) => {
  try {
    const { name, email, password, mobile, city, area, referralCode } =
      normalizeSignupPayload(req.body);

    if (!name || !email || !password || !mobile || !city || !area) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const userExists = await User.findOne({
      $or: [{ email }, { mobile }],
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Handle referral
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (referrer) referredBy = referrer._id;
    }

    const user = await User.create({
      name,
      email,
      password,
      mobile,
      city,
      area,
      referredBy,
      isVerified: true,
    });

    // Create referral record
    if (referredBy) {
      await Referral.create({
        referrerId: referredBy,
        referredUserId: user._id,
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login using Email + Password
 * @route   POST /api/auth/signin
 * @access  Public
 */
export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Logged-in User Profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -deviceTokens",
    );

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ["name", "email", "city", "area", "preferences"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -deviceTokens");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};
