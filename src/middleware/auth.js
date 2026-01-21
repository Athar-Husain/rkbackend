// const jwt = require("jsonwebtoken");
// const User = require("../models/User.model.js");
// const Admin = require("../models/Admin");

import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Admin from "../models/Admin.js";

// Protect routes - user authentication
export const protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Not authorized to access this route",
    });
  }
};

// Admin authentication middleware
export const adminProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Not authorized as admin",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select("-password");

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: "Admin not found",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Not authorized as admin",
    });
  }
};

// Store staff authentication
export const staffProtect = async (req, res, next) => {
  const { storeId, username, password } = req.body;

  if (!storeId || !username || !password) {
    return res.status(400).json({
      success: false,
      error: "Please provide store credentials",
    });
  }

  try {
    const Store = require("../models/Store.model.js");
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found",
      });
    }

    const staff = store.verifyStaff(username, password);

    if (!staff) {
      return res.status(401).json({
        success: false,
        error: "Invalid staff credentials",
      });
    }

    req.store = store;
    req.staff = staff;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (id, role = "user") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
