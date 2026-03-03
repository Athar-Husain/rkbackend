import express from "express";
import {
  getHomeDashboard,
  getBanners,
  getPromotions,
  getFeaturedProducts,
  getQuickAccess,
  searchOffers,
  getActivePromotionsForUser,
  getFeaturedPromotionsForUser,
  getActiveBannersForUser,
  getFeaturedBannersForUser,
} from "../controllers/homeController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// ========================
// Public routes
// ========================
router.get("/dashboard", protect, getHomeDashboard);
router.get("/banners", getBanners);
router.get("/promotions", getPromotions);
router.get("/featured-products", getFeaturedProducts);
router.get("/quick-access", getQuickAccess);
router.get("/search-offers", searchOffers);

// ========================
// Protected / user-specific routes
// ========================
router.get("/user-dashboard", protect, getHomeDashboard);
router.get("/user/active-promotions", protect, getActivePromotionsForUser);
router.get("/user/featured-promotions", protect, getFeaturedPromotionsForUser);
router.get("/user/active-banners", protect, getActiveBannersForUser);
router.get("/user/featured-banners", protect, getFeaturedBannersForUser);

export default router;
