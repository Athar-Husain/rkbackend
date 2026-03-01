import express from "express";
import {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  recordBannerImpression,
  recordBannerClick,
  fetchActiveBanners,
} from "../controllers/bannerController.js";
// import { adminProtect, userAuth } from "../middlewares/auth.js";
import { adminProtect, protect } from "../middleware/auth.js";

const router = express.Router();

/* ===============================
   ADMIN ROUTES
=============================== */
router.post("/", adminProtect, createBanner);
router.get("/", adminProtect, getAllBanners);
router.get("/:id", adminProtect, getBannerById);
router.patch("/:id", adminProtect, updateBanner);
router.delete("/:id", adminProtect, deleteBanner);

/* ===============================
   PUBLIC ROUTES
=============================== */
router.get("/active", protect, fetchActiveBanners); // optionally use userAuth middleware
router.post("/:id/impression", recordBannerImpression);
router.post("/:id/click", recordBannerClick);

export default router;
