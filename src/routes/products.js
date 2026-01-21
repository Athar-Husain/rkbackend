// const express = require("express");
// const router = express.Router();
// const productController = require("../controllers/productController");

import express from "express";
import {
  checkAvailability,
  compareProducts,
  getFeaturedProducts,
  getProductById,
  getProducts,
  getProductsByCategory,
  searchProducts,
} from "../controllers/productController.js";
const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/search/:query", searchProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/:id", getProductById);
router.get("/:id/availability", checkAvailability);
router.post("/compare", compareProducts);

// module.exports = router;

export default router;
