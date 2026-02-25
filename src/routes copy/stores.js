import express from "express";
import {
  createStore,
  getAllStoresAdmin,
  getStoreByIdAdmin,
  updateStore,
  toggleStoreStatus,
  getStores,
  getNearbyStores,
  getStoreById,
  getStoreHours,
  staffLogin,
  getStoreDashboard,
} from "../controllers/storeController.js";
import { staffProtect, adminProtect } from "../middleware/auth.js";

const router = express.Router();

// ========================
// Public routes
// ========================

// Get all stores (with filters, pagination)
router.get("/getStores", getStores);

// Get stores near a location
router.get("/nearby", getNearbyStores);

// Get single store by ID
router.get("/getStoreById/:id", getStoreById);

// Get store working hours
router.get("/getStoreHours/:id/hours", getStoreHours);

// ========================
// Store staff routes
// ========================

// Staff login
router.post("/staff-login", staffLogin);

// Staff dashboard (protected)
router.get("/getStoreD/:id/dashboard", staffProtect, getStoreDashboard);

// ========================
// Admin routes
// ========================

// Create a new store
router.post("/createStore", adminProtect, createStore);

// Get all stores for admin
router.get("/getAllStores", adminProtect, getAllStoresAdmin);

// Get single store by ID for admin
router.get("/getStoreById/:id", adminProtect, getStoreByIdAdmin);

// Update store details
router.put("/updateStore/:id", adminProtect, updateStore);

// Toggle store active/inactive
router.patch("/toggleStoreStatus/:id/status", adminProtect, toggleStoreStatus);

export default router;
