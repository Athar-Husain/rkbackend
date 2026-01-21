const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController");
const { protect, staffProtect } = require("../middleware/auth");

// Public routes
router.get("/", storeController.getStores);
router.get("/nearby", storeController.getNearbyStores);
router.get("/:id", storeController.getStoreById);
router.get("/:id/hours", storeController.getStoreHours);

// Store staff routes
router.post("/staff-login", storeController.staffLogin);
router.get("/:id/dashboard", staffProtect, storeController.getStoreDashboard);

module.exports = router;
