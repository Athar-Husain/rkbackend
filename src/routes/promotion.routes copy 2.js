import express from "express";
import { adminProtect, protect } from "../middleware/auth.js";
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

const router = express.Router();

// Fetch active promotions for frontend
router.get("/getactive", protect, fetchActivePromotions);
router.get("/getPromotionsForUser", protect, getPromotionsForUser);

/* ===============================
   ADMIN ROUTES
=============================== */
// Create promotion (Admin only)
router.post("/", adminProtect, createPromotion);

// Get all promotions with filters/pagination (Admin only)
router.get("/", adminProtect, getAllPromotions);

// Get single promotion by ID (Admin only)
router.get("/:id", adminProtect, getPromotionById);

// Update promotion (Admin only)
router.put("/:id", adminProtect, updatePromotion);

// Delete promotion (soft delete, Admin only)
router.delete("/:id", adminProtect, deletePromotion);

/* ===============================
   USER ROUTES
=============================== */

// Record impression (User)
router.post("/:id/impression", protect, recordPromotionImpression);

// Record click (User)
router.post("/:id/click", protect, recordPromotionClick);

// Record redemption (User)
router.post("/:id/redeem", protect, recordPromotionRedemption);

export default router;
