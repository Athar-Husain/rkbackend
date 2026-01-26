import express from "express";
import {
  createCity,
  addAreasToCity,
  getAllCitiesWithAreas,
  getCityDetails,
  removeAreaFromCity,
  toggleCityStatus,
  toggleAreaStatus,
  getCities,
  getAreasByCity,
  validateCityArea,
} from "../controllers/cityareaController.js";
import { adminProtect } from "../middleware/auth.js";
// } from "../controllers/cityArea.controller.js";

// import express from "express";
// import {
//   getCities,
//   getAreasByCity,
//   validateCityArea
// } from "../controllers/location.controller.js";

// import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * ADMIN ROUTES
 */

// Create a city (with optional areas)
router.post("/createCity", adminProtect, createCity);

// Add areas to an existing city
router.post("/addAreasToCity/:city", adminProtect, addAreasToCity);

// Remove an area from a city
router.delete(
  "/removeAreaFromCity/:city/area/:area",
  adminProtect,
  removeAreaFromCity,
);

// Toggle city active/inactive
router.patch("/toggleCityStatus/:city/status", adminProtect, toggleCityStatus);

// Toggle area active/inactive
router.patch(
  "/toggleAreaStatus/:city/area/:area/status",
  /* protect, admin, */ toggleAreaStatus,
);

/**
 * PUBLIC ROUTES
 */

// Get all active cities with areas
router.get("/getAllCitiesWithAreas", getAllCitiesWithAreas);

// Get single city with areas
router.get("/getCityDetails/:city", getCityDetails);

/**
 * PUBLIC LOCATION ROUTES
 */

// Get all active cities (dropdown)
router.get("/cities", getCities);

// Get active areas for a city
router.get("/cities/:city/areas", getAreasByCity);

// Validate city + area combination
router.post("/validate", validateCityArea);

export default router;
