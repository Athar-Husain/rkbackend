import express from "express";
const router = express.Router();

import {
  recordPurchase,
  getPurchaseById,
  getMyPurchases,
  getStorePurchases,
  getAllPurchases,
  updatePurchaseStatus,
  cancelPurchase,
  refundPurchase,
  addRating,
  updateFeedback,
  getStoreSalesReport,
  getUserSpendingReport,
  exportPurchases,
  deletePurchase,
} from "../controllers/purchaseController.js";
import {
  adminProtect,
  adminStaffProtect,
  protect,
  staffProtect,
} from "../middleware/auth.js";

// import { protect } from "../middlewares/auth.middleware.js";
// import {
// admin,
// storeStaff,
// adminOrStaff,
// } from "../middlewares/role.middleware.js";

/* =========================
   USER ROUTES
========================= */

// Get logged-in user's purchases
router.get("/getMyPurchases", protect, getMyPurchases);

// Get purchase by ID (user or staff)
router.get("/getPurchaseById/:id", protect, getPurchaseById);

// Add rating
router.post("/addRating/:id/rating", protect, addRating);

// Update feedback
router.patch("/updateFeedback/:id/feedback", protect, updateFeedback);

/* =========================
   STORE STAFF ROUTES
========================= */

// Record purchase (POS)
router.post("/recordPurchase", staffProtect, recordPurchase);

// Get store purchases
router.get("/store/:storeId", adminStaffProtect, getStorePurchases);

// Update purchase status
router.patch(
  "/updatePurchaseStatus/:id/status",
  adminStaffProtect,
  updatePurchaseStatus,
);

// Cancel purchase
router.patch("/cancelPurchase/:id/cancel", adminStaffProtect, cancelPurchase);

/* =========================
   REPORTS
========================= */

// Store sales report
router.get("/report/store/:storeId", adminStaffProtect, getStoreSalesReport);

// User spending report
router.get("/report/user/:userId", adminProtect, getUserSpendingReport);

/* =========================
   ADMIN ROUTES
========================= */

// Get all purchases
router.get("/getAllPurchases", adminProtect, getAllPurchases);

// Refund purchase
router.patch("/refundPurchase/:id/refund", adminProtect, refundPurchase);

// Export purchases to Excel
router.get("/export", adminProtect, exportPurchases);

// Delete purchase (hard delete)
router.delete("/deletePurchase/:id", adminProtect, deletePurchase);

export default router;
