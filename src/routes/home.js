import express from "express";
import { getHomeDashboard, getBanners, getPromotions, getFeaturedProducts, getQuickAccess, searchOffers } from "../controllers/homeController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// ========================
// Public routes
// ========================

// Home dashboard (public and protected)
router.get("/dashboard", getHomeDashboard);

// Get banners (public)
router.get("/banners", getBanners);

// Get promotions (public)
router.get("/promotions", getPromotions);

// Get featured products (public)
router.get("/featured-products", getFeaturedProducts);

// Get quick access tiles (public)
router.get("/quick-access", getQuickAccess);

// Search offers and promotions (public)
router.get("/search-offers", searchOffers);

// ========================
// Protected routes
// ========================

// User-specific home dashboard (protected)
router.get("/user-dashboard", protect, getHomeDashboard);

export default router;