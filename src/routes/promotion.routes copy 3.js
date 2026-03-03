import express from "express";
// import { adminProtect, protect } from "../middleware/auth.js";
import {
  createPromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  recordPromotionImpression,
  recordPromotionClick,
  recordPromotionRedemption,
  fetchActivePromotions,
  getPromotionsForUser,
} from "../controllers/promotionController.js";
import { protect, adminProtect } from "../middleware/auth.js";

const router = express.Router();

/* ===============================
   USER ROUTES
=============================== */
// Fetch active promotions for frontend

router.get("/getPromotionsForUser", protect, getPromotionsForUser);

router.get("/getactive", protect, fetchActivePromotions);

// Fetch promotions for user (frontend)

// Record impression (User)
router.post(
  "/recordPromotionImpression/:id/impression",
  protect,
  recordPromotionImpression,
);

// Record click (User)
router.post("/recordPromotionClick/:id/click", protect, recordPromotionClick);

// Record redemption (User)
router.post(
  "/recordPromotionRedemption/:id/redeem",
  protect,
  recordPromotionRedemption,
);

/* ===============================
   ADMIN ROUTES
=============================== */
// Create promotion (Admin only)

router.post("/createPromotion", adminProtect, createPromotion);

// Get all promotions with filters/pagination (Admin only)
router.get("/getAllPromotions", adminProtect, getAllPromotions);

// Get single promotion by ID (Admin only)
router.get("/getPromotionById/:id", getPromotionById);

// Update promotion (Admin only)
router.put("/updatePromotion/:id", adminProtect, updatePromotion);

// Delete promotion (soft delete, Admin only)
router.delete("/deletePromotion/:id", adminProtect, deletePromotion);

export default router;
