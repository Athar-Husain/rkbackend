import express from "express";
import {
  createBanner,
  deleteBanner,
  fetchActiveBanners,
  getAllBanners,
  getBannerById,
  updateBanner,
} from "../controllers/bannerController.js";

const router = express.Router();

router.post("/", createBanner);
router.get("/", getAllBanners);
router.get("/active", fetchActiveBanners);
router.get("/:id", getBannerById);
router.put("/:id", updateBanner);
router.delete("/:id", deleteBanner);

export default router;
