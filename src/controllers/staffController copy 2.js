import { validationResult } from "express-validator";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import Team from "../models/Team.model.js";
import { generateOtp } from "../utils/otp.js";
import asyncHandler from "express-async-handler";
import { generateToken } from "../utils/index.js";
// import ServiceArea from '../models/ServiceArea.model.js';

const { sign } = jwt;
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_EXPIRY_MINUTES = 10;
// const TOKEN_EXPIRES_IN_SECONDS = 60 * 2; // 2 minutes
const TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24; // 1 day

// -------------------
// USER / SELF CONTROLLERS
// -------------------

// Register a new team member (self-registration)
export const registerTeam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { firstName, lastName, phone, email, password, role } = req.body;

    // console.log('register team ', req.body);

    const existingTeam = await Team.findOne({ email });
    if (existingTeam)
      return res.status(400).json({ message: "Team member already exists" });

    const newTeam = new Team({
      firstName,
      lastName,
      phone,
      email,
      password,
      role,
    });
    const savedTeam = await newTeam.save();

    return res.status(201).json({
      message: "Team member registered successfully",
      team: {
        id: savedTeam._id,
        firstName: savedTeam.firstName,
        lastName: savedTeam.lastName,
        email: savedTeam.email,
        role: savedTeam.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// Login team member
export const loginTeam = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and Password are required" });
    }

    const team = await Team.findOne({ email });
    const isMatch = team && (await team.comparePassword(password));

    if (!team || !isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // const team = await Team.findOne({ email });
    // if (!team) return res.status(400).json({ message: 'Invalid credentials' });

    // const isMatch = await team.comparePassword(password);
    // if (!isMatch)
    //   return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(team._id); // typically expires in 2m
    res.cookie("token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      expires: new Date(Date.now() + TOKEN_EXPIRES_IN_SECONDS * 1000),
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      expiresIn: TOKEN_EXPIRES_IN_SECONDS,
      id: team._id,
      email: team.email,
      firstName: team.firstName,
      lastName: team.lastName,
      userType: team.userType,
      role: team.role,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error" });
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

// Change own password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const team = await Team.findById(req.user?.id);

    if (!team)
      return res.status(404).json({ message: "Team member not found" });

    const isMatch = await team.comparePassword(oldPassword);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect" });

    team.password = newPassword;
    await team.save();

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change Password Error:", error);
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

// Admin gets all team members
// export const getAllTeamMembers = async (req, res) => {
//   try {
//     const teams = await Team.find().select('-password');
//     return res.status(200).json(teams);
//   } catch (error) {
//     console.error('Admin Get All Team Members Error:', error);
//     return res.status(500).json({ message: 'Server error' });
//   }
// };

// src/controllers/yourController.js

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
