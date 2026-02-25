// import { Router } from "express";
import express from "express";

/* ----------- MIDDLEWARE ----------- */
// import { adminProtect } from "../middleware/auth.middleware.js";
import {
  addAreasToCity,
  checkAvailability,
  createCity,
  getAllCitiesWithAreas,
  getAreasByCity,
  getAreasByCitynew,
  getCities,
  getCitiesnew,
  getCityDetails,
  removeAreaFromCity,
  searchCities,
  toggleAreaStatus,
  toggleCityStatus,
  validateCityArea,
} from "../controllers/cityareaController.js";
import { adminProtect } from "../middleware/auth.js";

const router = express.Router();
/* ----------- CONTROLLERS 

/* =====================================================
   ADMIN ROUTES (CITY & AREA MANAGEMENT)
   Base: /api/locations
===================================================== */

router.post("/city", adminProtect, createCity);

router.post("/addAreasToCity/:city/areas", adminProtect, addAreasToCity);

router.delete(
  "/removeAreaFromCity/:city/area/:area",
  adminProtect,
  removeAreaFromCity,
);

router.patch("/toggleCityStatus/:city/status", adminProtect, toggleCityStatus);

router.patch(
  "/toggleAreaStatus/:city/area/:area/status",
  adminProtect,
  toggleAreaStatus,
);

/* =====================================================
   PUBLIC ROUTES (CITY & AREA DATA)
   Base: /api/city-area
===================================================== */

router.get("/getAllCitiesWithAreas", getAllCitiesWithAreas);
router.get("/getCityDetails/:city", getCityDetails);

/* =====================================================
   USER LOCATION ROUTES
   Base: /api/location
===================================================== */

// router.get("/getcities", getCitiesnew);
router.get("/getcities", getCities);
router.get("/getareasbycity/:city/areas", getAreasByCity);
router.post("/location/validate", validateCityArea);

/* =====================================================
   MOBILE-OPTIMIZED ROUTES
   Base: /api/location
===================================================== */

router.get("/location/cities", getCitiesnew);
router.get("/location/areas/:cityId", getAreasByCitynew);
router.get("/searchCities", searchCities);
router.post("/check-availability", checkAvailability);

export default router;
