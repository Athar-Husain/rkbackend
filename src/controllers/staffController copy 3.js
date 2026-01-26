// import User from "../models/User.model.js";
import NotificationService from "../services/notificationService.js";
import Referral from "../models/Referral.model.js";
import { generateToken } from "../middleware/auth.js";
import { formatCurrency } from "../utils/common.js";
import {
  generatePurposeOTP,
  verifyPurposeOTP,
  // verifyOTP,
  checkOTPExists,
} from "../services/otpService.js";
import Staff from "../models/Staff.model.js";

// @desc    Send OTP to mobile
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile number",
      });
    }

    // Check if user exists
    const user = await Staff.findOne({ mobile });
    const isResend = await checkOTPExists(mobile);

    // Send OTP
    const result = await sendOTP(mobile, isResend);

    res.status(200).json({
      success: true,
      message: result.message,
      userExists: !!user,
      otp: result.otp, // Only in development
    });
  } catch (error) {
    next(error);
  }
};

// Get own profile
export const getTeamProfile = async (req, res) => {
  console.log("getTeamProfile hit in controllers");

  try {
    const team = await Team.findById(req.user?.id)
      .select("-password")
      // .populate('leads area');
      .populate("area");
    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    return res.status(200).json({ team });
  } catch (error) {
    console.error("Get Profile Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Update own profile (partial update allowed)
export const updateTeam = async (req, res) => {
  try {
    const updates = {};
    ["firstName", "lastName", "phone", "email", "role"].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const updatedTeam = await Team.findByIdAndUpdate(req.user?.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedTeam)
      return res.status(404).json({ message: "Team member not found" });

    return res
      .status(200)
      .json({ message: "Team member updated", team: updatedTeam });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Logout (client should clear token)
export const logoutTeam = (req, res) => {
  return res
    .status(200)
    .json({ message: "Logged out successfully (clear token on client)" });
};

// Forgot password - send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const team = await Team.findOne({ email });
    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    const otp = generateOtp();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for resetting password is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
    otpStore.set(email.trim(), { otp, expires: Date.now() + OTP_EXPIRY_MS });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP Send Error:", error);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};

// Verify OTP for password reset
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP are required" });

    const record = otpStore.get(email.trim());
    if (!record || Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({ message: "OTP expired or invalid" });
    }

    if (parseInt(otp) === record.otp) {
      otpStore.delete(email);
      return res.status(200).json({ message: "OTP verified successfully" });
    } else {
      return res.status(400).json({ message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("OTP Verify Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createTeamMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, phone, email, password, role, region } =
      req.body;

    // Check for existing team member by either email or phone
    const existingTeam = await Team.findOne({
      $or: [{ email: email }, { phone: phone }],
    });

    if (existingTeam) {
      if (existingTeam.email === email) {
        return res
          .status(400)
          .json({ message: "Team member with this email already exists" });
      }
      if (existingTeam.phone === phone) {
        return res.status(400).json({
          message: "Team member with this phone number already exists",
        });
      }
    }

    // Extract area IDs from region
    const areaIds = region.map((r) => r._id);

    // Check if any area is already assigned to another team member
    const teamsWithAreas = await Team.find({ area: { $in: areaIds } })
      .populate({
        path: "area",
        select: "name region",
      })
      .lean(); // Populate specific fields of the area

    console.log("teamsWithAreas", teamsWithAreas); // Debugging

    if (teamsWithAreas.length > 0) {
      const assignedAreaNames = new Set();

      teamsWithAreas.forEach((team) => {
        team.area.forEach((area) => {
          if (areaIds.includes(area._id.toString())) {
            assignedAreaNames.add(area.region); // Make sure `area.name` exists
          }
        });
      });

      const assignedAreaNamesArray = [...assignedAreaNames];

      // Debugging the assigned areas
      console.log("Assigned Areas:", assignedAreaNamesArray);

      if (assignedAreaNamesArray.length > 0) {
        return res.status(400).json({
          message: `${assignedAreaNamesArray.join(", ")} already assigned`,
        });
      }

      return res.status(400).json({
        message: "No areas were found to be already assigned",
      });
    }

    // Create new team member
    const newTeam = new Team({
      firstName,
      lastName,
      phone,
      email,
      password,
      role,
      area: areaIds,
    });

    const savedTeam = await newTeam.save();

    console.log("Admin created team member:", savedTeam);

    return res.status(201).json({
      message: "Team member registered successfully",
    });
  } catch (error) {
    console.error("Admin Create Team Member Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllTeamMembers = async (req, res) => {
  try {
    const teams = await Team.find()
      .select("-password")
      .populate("area", "region");

    return res.status(200).json(teams);
  } catch (error) {
    console.error("Admin Get All Team Members Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin gets single team member by ID
export const getTeamMemberById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).select("-password");
    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    return res.status(200).json({ team });
  } catch (error) {
    console.error("Admin Get Team Member Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin updates team member by ID
export const updateTeamMember = async (req, res) => {
  try {
    const updates = {};
    ["firstName", "lastName", "phone", "email", "role"].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const updatedTeam = await Team.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedTeam)
      return res.status(404).json({ message: "Team member not found" });

    return res
      .status(200)
      .json({ message: "Team member updated successfully", team: updatedTeam });
  } catch (error) {
    console.error("Admin Update Team Member Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin resets team member's password
export const adminUpdateTeamMemberPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword)
      return res.status(400).json({ message: "New password is required" });

    const team = await Team.findById(req.params.id);
    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    team.password = newPassword;
    await team.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin deletes a team member by ID
export const deleteTeamMember = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    return res
      .status(200)
      .json({ message: "Team member deleted successfully" });
  } catch (error) {
    console.error("Admin Delete Team Member Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ================================
// Get Login Status
// ================================
export const getTeamLoginStatus = asyncHandler(async (req, res) => {
  console.log("getLoginStatus hit in controllers");
  const authHeader = req.headers.authorization;

  // console.log('authHeader in controllers', authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(200).json(false);
  }

  const token = authHeader.split(" ")[1];
  // console.log('token in controllers', token);
  if (!token) return res.status(401).json(false);

  const verified = jwt.verify(token, JWT_SECRET);
  // console.log('verified', verified);

  try {
    if (verified) {
      return res.json(true);
    } else {
      return res.json(false);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @desc    Verify OTP and login/register
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp, name, city, area, referralCode } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile and OTP",
      });
    }

    // Verify OTP
    const otpResult = await verifyOTP(mobile, otp);

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        error: otpResult.error,
      });
    }

    // Check if user exists
    let user = await Staff.findOne({ mobile });
    let isNewUser = false;

    if (!user) {
      // New user registration
      if (!name || !city || !area) {
        return res.status(400).json({
          success: false,
          error: "Please provide name, city, and area for registration",
        });
      }

      // Handle referral if code provided
      let referredBy = null;
      if (referralCode) {
        const referrer = await Staff.findOne({ referralCode });
        if (referrer) {
          referredBy = referrer._id;

          // Create referral record
          const referral = new Referral({
            referrerId: referrer._id,
            status: "PENDING",
          });

          // We'll save after user is created
          req.referral = referral;
        }
      }

      // Create new user
      user = await Staff.create({
        mobile,
        name,
        city,
        area,
        referredBy,
        isVerified: true,
      });

      isNewUser = true;

      // Complete referral if exists
      if (req.referral) {
        req.referral.referredUserId = user._id;
        await req.referral.save();

        // Send notification to referrer
        await NotificationService.sendPushNotification(
          referredBy,
          "New Referral!",
          `${name} registered using your referral code`,
        );
      }

      // Send welcome notification
      await NotificationService.sendSMS(
        mobile,
        `Welcome to RK Electronics, ${name}! Your account has been created successfully. Download our app for exclusive offers.`,
      );
    } else {
      // Existing user login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.deviceTokens;

    res.status(200).json({
      success: true,
      token,
      isNewUser,
      user: userResponse,
      message: isNewUser ? "Registration successful" : "Login successful",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, city, area, preferences } = req.body;

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (city) updateFields.city = city;
    if (area) updateFields.area = area;
    if (preferences) updateFields.preferences = preferences;

    // Update user
    const user = await Staff.findByIdAndUpdate(req.user.id, updateFields, {
      new: true,
      runValidators: true,
    }).select("-deviceTokens");

    res.status(200).json({
      success: true,
      user,
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register device token for push notifications
// @route   POST /api/auth/register-device
// @access  Private
export const registerDevice = async (req, res, next) => {
  try {
    const { token, platform = "android" } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Please provide device token",
      });
    }

    const result = await NotificationService.registerDeviceToken(
      req.user.id,
      token,
      platform,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we just send success response

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user dashboard data
// @route   GET /api/auth/dashboard
// @access  Private
export const getDashboard = async (req, res, next) => {
  try {
    const user = await Staff.findById(req.user.id)
      .select("-deviceTokens")
      .populate("registrationStore", "name location.address");

    // Get user's coupons
    const UserCoupon = require("../models/UserCoupon.model.js");
    const activeCoupons = await UserCoupon.countDocuments({
      userId: req.user.id,
      status: "ACTIVE",
    });

    // Get user's purchases
    const Purchase = require("../models/Purchase.model.js");
    const totalPurchases = await Purchase.countDocuments({
      userId: req.user.id,
    });
    const totalSpent = await Purchase.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    // Get user's referrals
    const Referral = require("../models/Referral.model.js");
    const referralStats = await Referral.getUserStats(req.user.id);

    // Get personalized offers
    const TargetingService = require("../services/targetingService");
    const recommendations =
      await TargetingService.getPersonalizedRecommendations(req.user.id);

    res.status(200).json({
      success: true,
      user,
      stats: {
        activeCoupons,
        totalPurchases,
        totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
        formattedTotalSpent: formatCurrency(
          totalSpent.length > 0 ? totalSpent[0].total : 0,
        ),
        ...referralStats,
      },
      recommendations: recommendations.success ? recommendations : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile number",
      });
    }

    // Check if user exists
    const user = await Staff.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Staff not found with this mobile number",
      });
    }

    // Send password reset OTP
    const result = await generatePurposeOTP(mobile, "PASSWORD_RESET", 30);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Please provide mobile, OTP, and new password",
      });
    }

    // Verify OTP
    const otpResult = await verifyPurposeOTP(mobile, "PASSWORD_RESET", otp);

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        error: otpResult.error,
      });
    }

    // Find user and update password
    const user = await Staff.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Staff not found",
      });
    }

    // Update user's password (in a real app, you'd hash this)
    // For now, we'll just mark that password was reset
    user.passwordResetAt = new Date();
    await user.save();

    // Send confirmation
    await NotificationService.sendSMS(
      mobile,
      "Your RK Electronics password has been reset successfully. If you did not request this, please contact support.",
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate referral code
// @route   GET /api/auth/validate-referral/:code
// @access  Public
export const validateReferralCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const user = await Staff.findOne({ referralCode: code });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Invalid referral code",
      });
    }

    res.status(200).json({
      success: true,
      referrer: {
        name: user.name,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register user with Email/Password
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res, next) => {
  try {
    const { name, email, password, mobile, city, area, referralCode } =
      req.body;

    // 1. Check if user already exists
    const userExists = await Staff.findOne({ $or: [{ email }, { mobile }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "Staff with this email or mobile already exists",
      });
    }

    // 2. Handle Referral (Logic borrowed from your verifyOTP)
    let referredBy = null;
    if (referralCode) {
      const referrer = await Staff.findOne({ referralCode });
      if (referrer) referredBy = referrer._id;
    }

    // 3. Create Staff
    const user = await Staff.create({
      name,
      email,
      password,
      mobile,
      city,
      area,
      referredBy,
      isVerified: true, // Mark as true since they provided credentials, or use email verification
    });

    // 4. Generate Token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      message: "Registration successful",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user with Email/Password
// @route   POST /api/auth/signin
// @access  Public
export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Please provide email and password" });
    }

    // 1. Find user and explicitly select password (because select: false in model)
    const user = await Staff.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // 2. Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // 3. Update last login
    user.lastLogin = new Date();
    await user.save();

    // 4. Send Response
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      token,
      user: userResponse,
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
};
