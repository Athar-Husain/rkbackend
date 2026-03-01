import Banner from "./models/Banner.model.js";
import { getActiveBanners } from "../services/banner.service.js";

export const createBanner = async (req, res) => {
  const banner = await Banner.create(req.body);
  res.status(201).json({ success: true, banner });
};

export const getAllBanners = async (req, res) => {
  const banners = await Banner.find().sort({ createdAt: -1 });
  res.json({ success: true, banners });
};

export const getBannerById = async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  res.json({ success: true, banner });
};

export const updateBanner = async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json({ success: true, banner });
};

export const deleteBanner = async (req, res) => {
  await Banner.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};

export const fetchActiveBanners = async (req, res) => {
  const banners = await getActiveBanners({
    user: req.user,
    category: req.query.category,
    brand: req.query.brand,
  });

  res.json({ success: true, banners });
};
