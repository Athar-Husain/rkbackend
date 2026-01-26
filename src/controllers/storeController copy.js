import Store from "../models/Store.model.js";

// @desc    Create a new RK Electronics Branch
// @route   POST /api/admin/stores
export const createStore = async (req, res) => {
  try {
    const store = await Store.create(req.body);
    res.status(201).json({ success: true, data: store });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all branches filtered by City (Ballari, Hospet, etc.)
// @route   GET /api/stores
export const getStores = async (req, res) => {
  try {
    const { city } = req.query;
    const filter = city ? { "location.city": city.toUpperCase() } : {};

    const stores = await Store.find(filter).sort({ "location.area": 1 });
    res.status(200).json({ success: true, count: stores.length, data: stores });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all unique areas in a city for Targeting Dropdowns
// @route   GET /api/stores/areas/:city
export const getAreasByCity = async (req, res) => {
  try {
    const areas = await Store.find({
      "location.city": req.params.city.toUpperCase(),
    }).distinct("location.area");

    res.status(200).json({ success: true, data: areas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
