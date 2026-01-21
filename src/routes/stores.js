// const express = require("express");
// const router = express.Router();
// const storeController = require("../controllers/storeController");
// const { protect, staffProtect } = require("../middleware/auth");

import express from "express";
import {
  getNearbyStores,
  getStoreById,
  getStoreDashboard,
  getStoreHours,
  getStores,
  staffLogin,
} from "../controllers/storeController.js";
import { staffProtect } from "../middleware/auth.js";
const router = express.Router();
// import storeController from "../controllers/storeController.js";

// Public routes
router.get("/", getStores);
router.get("/nearby", getNearbyStores);
router.get("/:id", getStoreById);
router.get("/:id/hours", getStoreHours);

// Store staff routes
router.post("/staff-login", staffLogin);
router.get("/:id/dashboard", staffProtect, getStoreDashboard);

// module.exports = router;

export default router;
