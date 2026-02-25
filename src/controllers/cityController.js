import City from "../models/City.model.js";
import Area from "../models/Area.model.js";
import logger from "../utils/logger.js";

class CityController {
  /**
   * @desc    Get all cities
   * @route   GET /api/cities
   * @access  Public
   */
  getCities = async (req, res) => {
    try {
      const cities = await City.find({ isActive: true })
        .select("name state country deliveryRadius")
        .sort({ name: 1 });

      return res.status(200).json({
        success: true,
        count: cities.length,
        cities,
      });
    } catch (error) {
      logger.error("Get cities error", {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to fetch cities",
      });
    }
  };

  /**
   * @desc    Get areas by city
   * @route   GET /api/cities/:cityId/areas
   * @access  Public
   */
  getAreasByCity = async (req, res) => {
    try {
      const { cityId } = req.params;

      // Check if city exists
      const city = await City.findById(cityId);
      if (!city || !city.isActive) {
        return res.status(404).json({
          success: false,
          message: "City not found",
        });
      }

      const areas = await Area.find({
        city: cityId,
        isActive: true,
      })
        .select(
          "name pincode deliveryCharge minOrderAmount estimatedDeliveryTime",
        )
        .sort({ name: 1 });

      return res.status(200).json({
        success: true,
        city: {
          _id: city._id,
          name: city.name,
          state: city.state,
        },
        count: areas.length,
        areas,
      });
    } catch (error) {
      logger.error("Get areas error", {
        cityId: req.params.cityId,
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to fetch areas",
      });
    }
  };

  /**
   * @desc    Search cities and areas
   * @route   GET /api/cities/search
   * @access  Public
   */
  searchCities = async (req, res) => {
    try {
      const { query } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Search query must be at least 2 characters",
        });
      }

      // Search cities
      const cities = await City.find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { state: { $regex: query, $options: "i" } },
        ],
      })
        .select("name state")
        .limit(10);

      // Search areas
      const areas = await Area.find({
        isActive: true,
        name: { $regex: query, $options: "i" },
      })
        .populate("city", "name state")
        .select("name pincode city")
        .limit(10);

      return res.status(200).json({
        success: true,
        cities,
        areas,
      });
    } catch (error) {
      logger.error("Search cities error", {
        query: req.query.query,
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to search cities",
      });
    }
  };

  /**
   * @desc    Check service availability
   * @route   POST /api/cities/check-availability
   * @access  Public
   */
  checkAvailability = async (req, res) => {
    try {
      const { cityId, areaId } = req.body;

      if (!cityId || !areaId) {
        return res.status(400).json({
          success: false,
          message: "City and area are required",
        });
      }

      // Check city
      const city = await City.findOne({
        _id: cityId,
        isActive: true,
      });

      if (!city) {
        return res.status(404).json({
          success: false,
          message: "Service not available in this city",
          available: false,
        });
      }

      // Check area
      const area = await Area.findOne({
        _id: areaId,
        city: cityId,
        isActive: true,
      });

      if (!area) {
        return res.status(404).json({
          success: false,
          message: "Service not available in this area",
          available: false,
        });
      }

      return res.status(200).json({
        success: true,
        available: true,
        city: {
          _id: city._id,
          name: city.name,
        },
        area: {
          _id: area._id,
          name: area.name,
          deliveryCharge: area.deliveryCharge,
          minOrderAmount: area.minOrderAmount,
          estimatedDeliveryTime: area.estimatedDeliveryTime,
        },
      });
    } catch (error) {
      logger.error("Check availability error", {
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to check service availability",
      });
    }
  };
}

export default new CityController();
