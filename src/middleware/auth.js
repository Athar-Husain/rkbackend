import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Admin from "../models/Admin.js";
import Store from "../models/Store.model.js";
import Staff from "../models/Staff.model.js";
import bcrypt from "bcryptjs";

// ================================
// Normal User Protect
// ================================
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token)
    return res.status(401).json({ success: false, error: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user)
      return res.status(401).json({ success: false, error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

// ================================
// Admin Protect
// ================================
export const adminProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.adminToken) {
    token = req.cookies.adminToken;
  }

  if (!token)
    return res
      .status(401)
      .json({ success: false, error: "Admin not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin || admin.userType?.toLowerCase() !== "admin") {
      return res
        .status(403)
        .json({ success: false, error: "Access denied: Not an Admin" });
    }

    req.user = admin;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

// ================================
// Staff Protect
// ================================
export const staffProtect = async (req, res, next) => {
  const { storeId, username, password } = req.body;

  if (!storeId || !username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Store credentials required" });
  }

  try {
    const staff = await Staff.findOne({ storeId, username }).select(
      "+password",
    );

    if (!staff)
      return res.status(401).json({ success: false, error: "Staff not found" });

    const isMatch = await staff.matchPassword(password);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, error: "Invalid password" });

    req.staff = staff;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ================================
// Admin or Staff Protect
// ================================
export const adminStaffProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token)
    return res.status(401).json({ success: false, error: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try admin first
    const admin = await Admin.findById(decoded.id).select("-password");
    if (admin) {
      req.user = admin;
      return next();
    }

    // Try staff
    const staff = await Staff.findById(decoded.id).select("-password");
    if (staff) {
      req.user = staff;
      return next();
    }

    return res
      .status(401)
      .json({ success: false, error: "Admin/Staff not found" });
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
};

// ================================
// Store Protect (by storeId in params)
// ================================
export const storeProtect = async (req, res, next) => {
  const { storeId } = req.params;

  if (!storeId)
    return res
      .status(400)
      .json({ success: false, error: "Store ID is required" });

  try {
    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ success: false, error: "Store not found" });

    req.store = store;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ================================
// JWT Generator
// ================================
export const generateToken = (id, role = "user") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};
