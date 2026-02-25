// const express = require("express");
// const router = express.Router();
// const purchaseController = require("../controllers/purchaseController");
// const { protect, staffProtect, adminProtect } = require("../middleware/auth");

import express from "express";
import { adminProtect, protect, staffProtect } from "../middleware/auth.js";
import {
  addRating,
  exportPurchases,
  getPurchaseById,
  getStoreSalesReport,
  recordPurchase,
  updatePurchaseStatus,
} from "../controllers/purchaseController.js";
const router = express.Router();

// User routes
router.use(protect);
router.get("/:id", getPurchaseById);
router.post("/:id/rating", addRating);

// Store staff routes
router.post("/", staffProtect, recordPurchase);
router.put("/:id/status", staffProtect, updatePurchaseStatus);
router.get("/report/store/:storeId", staffProtect, getStoreSalesReport);

// Admin routes
router.get("/export", adminProtect, exportPurchases);

// module.exports = router;
export default router;

