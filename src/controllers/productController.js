// const Product = require("../models/Product.model.js");
// const Store = require("../models/Store.model.js");

import Product from "../models/Product.model.js";
import Store from "../models/Store.model.js";

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
      inStock = false,
      featured = false,
      bestSeller = false,
      newArrival = false,
    } = req.query;

    // Build query
    const query = { isActive: true };

    if (category) {
      query.category = category.toUpperCase();
    }

    if (brand) {
      query.brand = new RegExp(brand, "i");
    }

    if (minPrice || maxPrice) {
      query.sellingPrice = {};
      if (minPrice) query.sellingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.sellingPrice.$lte = parseFloat(maxPrice);
    }

    if (inStock === "true") {
      query.overallStock = { $gt: 0 };
    }

    if (featured === "true") {
      query.isFeatured = true;
    }

    if (bestSeller === "true") {
      query.isBestSeller = true;
    }

    if (newArrival === "true") {
      query.isNewArrival = true;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { brand: new RegExp(search, "i") },
        { model: new RegExp(search, "i") },
        { category: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    // Sort options
    const sort = {};
    if (sortBy === "price") {
      sort.sellingPrice = sortOrder === "asc" ? 1 : -1;
    } else if (sortBy === "discount") {
      sort.discountPercentage = sortOrder === "asc" ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    }

    const skip = (page - 1) * limit;

    // Execute query
    const products = await Product.find(query)
      .populate(
        "availableInStores.storeId",
        "name location.address location.city location.area",
      )
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // Get categories for filters
    const categories = await Product.distinct("category", { isActive: true });
    const brands = await Product.distinct("brand", { isActive: true });

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      filters: {
        categories,
        brands,
        priceRange: {
          min: await Product.findOne({ isActive: true })
            .sort("sellingPrice")
            .select("sellingPrice"),
          max: await Product.findOne({ isActive: true })
            .sort("-sellingPrice")
            .select("sellingPrice"),
        },
      },
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID or SKU
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    let product;

    // Check if ID is a valid MongoDB ObjectId
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(req.params.id).populate(
        "availableInStores.storeId",
        "name location.address location.city location.area contact.phone timings",
      );
    } else {
      // Assume it's an SKU
      product = await Product.findOne({
        sku: req.params.id.toUpperCase(),
      }).populate(
        "availableInStores.storeId",
        "name location.address location.city location.area contact.phone timings",
      );
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    // Get similar products
    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
    })
      .limit(4)
      .select("name brand model sellingPrice discountPercentage images");

    // Get applicable coupons for this product
    let applicableCoupons = [];
    if (req.user) {
      const TargetingService = require("../services/targetingService");
      const couponsResult = await TargetingService.getEligibleCouponsForUser(
        req.user.id,
      );

      if (couponsResult.success) {
        applicableCoupons = couponsResult.categorizedCoupons.common
          .concat(couponsResult.categorizedCoupons.geographic)
          .filter((coupon) => {
            // Check if coupon applies to this product
            if (coupon.productRules.type === "ALL_PRODUCTS") return true;
            if (
              coupon.productRules.type === "CATEGORY" &&
              coupon.productRules.categories.includes(product.category)
            )
              return true;
            if (
              coupon.productRules.type === "BRAND" &&
              coupon.productRules.brands.includes(product.brand)
            )
              return true;
            if (
              coupon.productRules.type === "PRODUCT" &&
              coupon.productRules.products.some(
                (p) => p._id.toString() === product._id.toString(),
              )
            )
              return true;
            return false;
          });
      }
    }

    res.status(200).json({
      success: true,
      product,
      similarProducts,
      applicableCoupons: applicableCoupons.slice(0, 3), // Limit to 3 coupons
      storeAvailability: product.availableInStores.map((store) => ({
        store: store.storeId,
        stock: store.stock,
        lastUpdated: store.lastUpdated,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
export const getProductsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const {
      page = 1,
      limit = 20,
      brand,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;

    const products = await Product.findByCategory(category, {
      brand,
      sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      skip,
      limit: parseInt(limit),
    });

    const total = await Product.countDocuments({
      category: category.toUpperCase(),
      isActive: true,
    });

    // Get subcategories
    const subcategories = await Product.distinct("subcategory", {
      category: category.toUpperCase(),
      isActive: true,
      subcategory: { $ne: null },
    });

    // Get brands in this category
    const brands = await Product.distinct("brand", {
      category: category.toUpperCase(),
      isActive: true,
    });

    res.status(200).json({
      success: true,
      category: category.toUpperCase(),
      count: products.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      filters: {
        subcategories,
        brands,
      },
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search products
// @route   GET /api/products/search/:query
// @access  Public
export const searchProducts = async (req, res, next) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const products = await Product.searchProducts(query, {
      skip,
      limit: parseInt(limit),
      sort: { _id: -1 },
    });

    const total = await Product.countDocuments({
      isActive: true,
      $or: [
        { name: new RegExp(query, "i") },
        { brand: new RegExp(query, "i") },
        { model: new RegExp(query, "i") },
        { category: new RegExp(query, "i") },
        { subcategory: new RegExp(query, "i") },
        { description: new RegExp(query, "i") },
      ],
    });

    // Get search suggestions
    const suggestions = await Product.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { name: new RegExp(query, "i") },
            { brand: new RegExp(query, "i") },
            { category: new RegExp(query, "i") },
          ],
        },
      },
      {
        $group: {
          _id: null,
          brands: { $addToSet: "$brand" },
          categories: { $addToSet: "$category" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      query,
      count: products.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      suggestions:
        suggestions.length > 0
          ? suggestions[0]
          : { brands: [], categories: [] },
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      isActive: true,
      $or: [
        { isFeatured: true },
        { isBestSeller: true },
        { isNewArrival: true },
      ],
    })
      .limit(10)
      .select(
        "name brand model sellingPrice discountPercentage images isFeatured isBestSeller isNewArrival",
      );

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check product availability in stores
// @route   GET /api/products/:id/availability
// @access  Public
export const checkAvailability = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "availableInStores.storeId",
      "name location.address location.city location.area contact.phone",
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const { city, area } = req.query;

    let availableStores = product.availableInStores;

    // Filter by city/area if provided
    if (city) {
      availableStores = availableStores.filter(
        (store) =>
          store.storeId.location.city.toLowerCase() === city.toLowerCase(),
      );
    }

    if (area) {
      availableStores = availableStores.filter(
        (store) =>
          store.storeId.location.area.toLowerCase() === area.toLowerCase(),
      );
    }

    // Sort by stock availability (highest first)
    availableStores.sort((a, b) => b.stock - a.stock);

    res.status(200).json({
      success: true,
      product: {
        name: product.name,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
      },
      totalStock: product.overallStock,
      availableStores: availableStores.map((store) => ({
        store: store.storeId,
        stock: store.stock,
        lastUpdated: store.lastUpdated,
        status: store.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Compare products
// @route   POST /api/products/compare
// @access  Public
export const compareProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (
      !productIds ||
      !Array.isArray(productIds) ||
      productIds.length < 2 ||
      productIds.length > 4
    ) {
      return res.status(400).json({
        success: false,
        error: "Please provide 2 to 4 product IDs to compare",
      });
    }

    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    }).select(
      "name brand model category sellingPrice mrp discountPercentage specifications images",
    );

    if (products.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Could not find products to compare",
      });
    }

    // Extract common specifications for comparison
    const allSpecs = new Set();
    products.forEach((product) => {
      if (product.specifications) {
        Object.keys(product.specifications).forEach((key) => {
          allSpecs.add(key);
        });
      }
    });

    // Create comparison matrix
    const comparison = Array.from(allSpecs).map((spec) => {
      const row = { specification: spec };
      products.forEach((product) => {
        row[product._id] = product.specifications.get(spec) || "N/A";
      });
      return row;
    });

    // Add pricing comparison
    comparison.unshift({
      specification: "Price",
      ...products.reduce((obj, product) => {
        obj[product._id] = `₹${product.sellingPrice.toLocaleString("en-IN")}`;
        return obj;
      }, {}),
    });

    res.status(200).json({
      success: true,
      products,
      comparison,
      summary: {
        cheapest: products.reduce((min, product) =>
          product.sellingPrice < min.sellingPrice ? product : min,
        ),
        bestDiscount: products.reduce((max, product) =>
          product.discountPercentage > max.discountPercentage ? product : max,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};
