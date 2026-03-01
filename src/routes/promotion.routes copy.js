import express from "express";
import * as controller from "../controllers/promotion.controller.js";
import {
  createPromotion,
  deletePromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
} from "../controllers/promotionController.js";
import { fetchActivePromotions } from "../controllers/promotionController copy.js";

const router = express.Router();

router.post("/", createPromotion);
router.get("/", getAllPromotions);
router.get("/active", fetchActivePromotions);
router.get("/:id", getPromotionById);
router.put("/:id", updatePromotion);
router.delete("/:id", deletePromotion);

export default router;
