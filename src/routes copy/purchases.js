const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const { protect, staffProtect, adminProtect } = require("../middleware/auth");

// User routes
router.use(protect);
router.get("/:id", purchaseController.getPurchaseById);
router.post("/:id/rating", purchaseController.addRating);

// Store staff routes
router.post("/", staffProtect, purchaseController.recordPurchase);
router.put(
  "/:id/status",
  staffProtect,
  purchaseController.updatePurchaseStatus
);
router.get(
  "/report/store/:storeId",
  staffProtect,
  purchaseController.getStoreSalesReport
);

// Admin routes
router.get("/export", adminProtect, purchaseController.exportPurchases);

module.exports = router;
