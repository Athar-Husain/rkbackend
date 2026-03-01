import Promotion from "../models/Promotion.model.js";
import { getActivePromotions } from "../services/promotion.service.js";

export const createPromotion = async (req, res) => {
  const promo = await Promotion.create(req.body);
  res.status(201).json({ success: true, promo });
};

export const getAllPromotions = async (req, res) => {
  const promos = await Promotion.find().sort({ createdAt: -1 });
  res.json({ success: true, promos });
};

export const getPromotionById = async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  res.json({ success: true, promo });
};

export const updatePromotion = async (req, res) => {
  const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json({ success: true, promo });
};

export const deletePromotion = async (req, res) => {
  await Promotion.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};

export const fetchActivePromotions = async (req, res) => {
  const promos = await getActivePromotions({
    user: req.user,
    category: req.query.category,
    brand: req.query.brand,
    featured: req.query.featured === "true",
    limit: parseInt(req.query.limit) || 20,
  });

  res.json({ success: true, promos });
};
