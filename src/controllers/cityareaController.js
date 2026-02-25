import mongoose from "mongoose";
import CityArea from "../models/CityArea.model.js";
import { fail } from "../utils/common.js";
import logger from "../utils/logger.js";

/**
 * @desc    Create a new City (optionally with areas)
 * @route   POST /api/city-area/city
 * @access  Admin
 */
export const createCity1 = async (req, res, next) => {
  try {
    const { city, areas = [] } = req.body;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "City name is required",
      });
    }

    const existingCity = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (existingCity) {
      return res.status(400).json({
        success: false,
        error: "City already exists",
      });
    }

    const cityDoc = await CityArea.create({
      city,
      areas: areas.map((area) => ({
        name: area.name,
        pincodes: area.pincodes || [],
      })),
    });

    res.status(201).json({
      success: true,
      message: "City created successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const createCity = async (req, res, next) => {
  try {
    const { city, areas = [] } = req.body;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "City name is required",
      });
    }

    // Format the city name to uppercase with hyphens
    const formattedCity = city.toUpperCase().replace(/\s+/g, "-");

    const existingCity = await CityArea.findOne({
      city: new RegExp(`^${formattedCity}$`, "i"),
    });

    if (existingCity) {
      return res.status(400).json({
        success: false,
        error: "City already exists",
      });
    }

    const cityDoc = await CityArea.create({
      city: formattedCity,
      areas: areas.map((area) => ({
        name: area.name.toUpperCase().replace(/\s+/g, "-"),
        pincodes: area.pincodes || [],
      })),
    });

    res.status(201).json({
      success: true,
      message: "City created successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add single or multiple areas to an existing city
 * @route   POST /api/city-area/:city/areas
 * @access  Admin
 */
export const addAreasToCityold = async (req, res, next) => {
  try {
    const { city, areas } = req.params;
    // const { areas } = req.body;

    if (!Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Areas array is required",
      });
    }

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    areas.forEach((area) => {
      const exists = cityDoc.areas.some(
        (a) => a.name.toLowerCase() === area.name.toLowerCase(),
      );

      if (!exists) {
        cityDoc.areas.push({
          name: area.name,
          pincodes: area.pincodes || [],
        });
      }
    });

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Areas added successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const addAreasToCity1 = async (req, res, next) => {
  try {
    const { city } = req.params;
    const { areas } = req.body;

    // console.log("req body", req.body);

    if (!Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Areas array is required",
      });
    }

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    areas.forEach((area) => {
      const exists = cityDoc.areas.some(
        (a) => a.name.toLowerCase() === area.name.toLowerCase(),
      );

      if (!exists) {
        cityDoc.areas.push({
          name: area.name,
          pincodes: area.pincodes || [],
        });
      }
    });

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Areas added successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const addAreasToCity = async (req, res, next) => {
  try {
    const { city } = req.params;
    const { areas } = req.body;

    if (!Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Areas array is required",
      });
    }

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    areas.forEach((area) => {
      // Format the area name to uppercase with hyphens
      const formattedAreaName = area.name.toUpperCase().replace(/\s+/g, "-");
      const exists = cityDoc.areas.some(
        (a) => a.name.toLowerCase() === formattedAreaName.toLowerCase(),
      );

      if (!exists) {
        cityDoc.areas.push({
          name: formattedAreaName,
          pincodes: area.pincodes || [],
        });
      }
    });

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Areas added successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active cities with areas
 * @route   GET /api/city-area
 * @access  Public
 */
export const getAllCitiesWithAreas = async (req, res, next) => {
  try {
    const cities = await CityArea.getAllCitiesWithAreas();

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single city with areas
 * @route   GET /api/city-area/:city
 * @access  Public
 */
export const getCityDetails = async (req, res, next) => {
  try {
    const { city } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    res.status(200).json({
      success: true,
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove an area from a city
 * @route   DELETE /api/city-area/:city/area/:area
 * @access  Admin
 */
export const removeAreaFromCity = async (req, res, next) => {
  try {
    const { city, area } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const originalLength = cityDoc.areas.length;

    cityDoc.areas = cityDoc.areas.filter(
      (a) => a.name.toLowerCase() !== area.toLowerCase(),
    );

    if (cityDoc.areas.length === originalLength) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: "Area removed successfully",
      data: cityDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle city active/inactive
 * @route   PATCH /api/city-area/:city/status
 * @access  Admin
 */
export const toggleCityStatus = async (req, res, next) => {
  try {
    const { city } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    cityDoc.isActive = !cityDoc.isActive;
    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: `City ${cityDoc.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle area active/inactive
 * @route   PATCH /api/city-area/:city/area/:area/status
 * @access  Admin
 */
export const toggleAreaStatus = async (req, res, next) => {
  try {
    const { city, area } = req.params;

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
    });

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const areaDoc = cityDoc.areas.find(
      (a) => a.name.toLowerCase() === area.toLowerCase(),
    );

    if (!areaDoc) {
      return res.status(404).json({
        success: false,
        error: "Area not found",
      });
    }

    areaDoc.isActive = !areaDoc.isActive;
    await cityDoc.save();

    res.status(200).json({
      success: true,
      message: `Area ${areaDoc.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    next(error);
  }
};

// import CityArea from "../models/CityArea.model.js";

/**
 * @desc    Get all active cities (User selection)
 * @route   GET /api/location/cities
 * @access  Public
 */
export const getCities = async (req, res, next) => {
  try {
    const cities = await CityArea.find({ isActive: true })
      .select("city")
      .sort({ city: 1 });

    // console.log("cities", cities);

    res.status(200).json({
      success: true,
      // data: cities.map((c) => c.city),
      data: cities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get active areas for a selected city
 * @route   GET /api/location/cities/:city/areas
 * @access  Public
 */
export const getAreasByCity1 = async (req, res, next) => {
  try {
    const { city } = req.params;
    // console.log("req.params", req.params);
    // console.log("req.body", req.body);

    const cityDoc = await CityArea.findOne({
      city: new RegExp(`^${city}$`, "i"),
      isActive: true,
    }).select("areas");

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const activeAreas = cityDoc.areas
      .filter((area) => area.isActive)
      .map((area) => ({
        name: area.name,
        pincodes: area.pincodes,
      }));

    res.status(200).json({
      success: true,
      city,
      areas: activeAreas,
    });
  } catch (error) {
    next(error);
  }
};
export const getAreasByCity = async (req, res, next) => {
  try {
    const { city } = req.params;

    // console.log("req.params", req.params);
    // console.log("req.body", req.body);

    let cityDoc;

    // If the param is a valid MongoDB ObjectId, search by _id
    if (mongoose.Types.ObjectId.isValid(city)) {
      cityDoc = await CityArea.findOne({ _id: city, isActive: true }).select(
        "areas city",
      );
    } else {
      // fallback: search by city name (case-insensitive)
      cityDoc = await CityArea.findOne({
        city: new RegExp(`^${city}$`, "i"),
        isActive: true,
      }).select("areas city");
    }

    if (!cityDoc) {
      return res.status(404).json({
        success: false,
        error: "City not found",
      });
    }

    const activeAreas = (cityDoc.areas || [])
      .filter((area) => area.isActive)
      .map((area) => ({
        _id: area._id,
        name: area.name,
        pincodes: area.pincodes,
      }));

    res.status(200).json({
      success: true,
      city: cityDoc.city,
      areas: activeAreas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate city & area combination
 * @route   POST /api/location/validate
 * @access  Public
 */
export const validateCityArea = async (req, res, next) => {
  try {
    const { city, area } = req.body;

    if (!city || !area) {
      return res.status(400).json({
        success: false,
        error: "City and area are required",
      });
    }

    const isValid = await CityArea.isValidCityArea(city, area);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Invalid city or area",
      });
    }

    res.status(200).json({
      success: true,
      message: "Valid city and area",
    });
  } catch (error) {
    next(error);
  }
};

// const isValidLocation = await CityArea.isValidCityArea(city, area);
// if (!isValidLocation) {
//   return res.status(400).json({
//     success: false,
//     error: "Selected city and area are not serviceable",
//   });
// }

/* =====================================================
   CITIES & AREAS (unchanged)
===================================================== */
export const getCitiesnew = async (_, res) => {
  // console.log("getcities hit");
  try {
    const cities = await CityArea.getCitiesForMobile();
    return res.json({ success: true, cities });
  } catch (error) {
    logger.error("Get cities error", error);
    return fail(res, 500, "Failed to fetch cities");
  }
};

export const getAreasByCitynew = async (req, res) => {
  try {
    const { cityId } = req.params;
    const data = await CityArea.getAreasByCityId(cityId);
    if (!data.city) return fail(res, 404, "City not found");
    return res.json({ success: true, ...data });
  } catch (error) {
    logger.error("Get areas error", error);
    return fail(res, 500, "Failed to fetch areas");
  }
};

export const searchCities = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return fail(res, 400, "Query too short");

    const results = await CityArea.searchLocations(query);
    return res.json({ success: true, results });
  } catch (error) {
    logger.error("Search error", error);
    return fail(res, 500, "Search failed");
  }
};

export const checkAvailability = async (req, res) => {
  try {
    const { cityId, areaId } = req.body;
    const result = await CityArea.checkServiceAvailability(cityId, areaId);
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Availability error", error);
    return fail(res, 500, "Check failed");
  }
};
