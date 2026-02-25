import express from "express";
import {
  deleteUserByAdmin,
  getAllUsers,
  getProfile,
  getUserById,
  registerUser,
  updatePreferences,
  updateProfile,
  updateUserByAdmin,
} from "../controllers/userController.js";
import { adminProtect, protect } from "../middleware/auth.js";

const router = express.Router();

// -------------------- PUBLIC ROUTES -------------------- //
// User registration (with optional referral code)
router.post("/register", registerUser);

// -------------------- PROTECTED ROUTES -------------------- //
// Get logged-in user profile
router.get("/getProfile", protect, getProfile);

// Update logged-in user profile
router.patch("/updateProfile", protect, updateProfile);

// Update user preferences
router.patch("/updatePreferences", protect, updatePreferences);

// Delete / deactivate account
// router.delete("/deleteAccount", protect, deleteAccount);

// -------------------- ADMIN ROUTES -------------------- //
// Get all users with pagination
router.get("/getAllUsers", adminProtect, getAllUsers);

// Get specific user by ID
router.get("/getUserById/:id", adminProtect, getUserById);

// Update user by admin
router.patch("/updateUserByAdmin/:id", adminProtect, updateUserByAdmin);

// Delete user by admin
router.delete("/deleteUserByAdmin/:id", adminProtect, deleteUserByAdmin);

export default router;
