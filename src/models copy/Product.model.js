const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Basic Information
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "MOBILE",
        "TELEVISION",
        "AC",
        "REFRIGERATOR",
        "WASHING_MACHINE",
        "AUDIO",
        "KITCHEN_APPLIANCE",
        "LAPTOP",
        "CAMERA",
        "ACCESSORY",
      ],
    },
    subcategory: String,
    brand: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },

    // Description
    description: String,
    highlights: [String],

    // Media
    images: [
      {
        url: String,
        alt: String,
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Specifications (Flexible structure)
    specifications: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Pricing
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Inventory
    availableInStores: [
      {
        storeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Store",
        },
        stock: {
          type: Number,
          default: 0,
        },
        lastUpdated: Date,
      },
    ],

    // Stock status (calculated)
    overallStock: {
      type: Number,
      default: 0,
    },

    // Product Attributes
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,

    // SEO
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate slug before saving
productSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug =
      `${this.brand.toLowerCase()}-${this.model.toLowerCase()}-${this.sku.toLowerCase()}`.replace(
        /\s+/g,
        "-"
      );
  }

  // Calculate discount percentage
  if (this.mrp && this.sellingPrice) {
    this.discountPercentage = Math.round(
      ((this.mrp - this.sellingPrice) / this.mrp) * 100
    );
  }

  // Calculate overall stock
  if (this.availableInStores && this.availableInStores.length > 0) {
    this.overallStock = this.availableInStores.reduce(
      (total, store) => total + (store.stock || 0),
      0
    );
  }

  next();
});

// Virtual for formatted price
productSchema.virtual("formattedMRP").get(function () {
  return `₹${this.mrp.toLocaleString("en-IN")}`;
});

productSchema.virtual("formattedSellingPrice").get(function () {
  return `₹${this.sellingPrice.toLocaleString("en-IN")}`;
});

// Virtual for savings
productSchema.virtual("savings").get(function () {
  return this.mrp - this.sellingPrice;
});

productSchema.virtual("formattedSavings").get(function () {
  return `₹${(this.mrp - this.sellingPrice).toLocaleString("en-IN")}`;
});

// Static method to get products by category
productSchema.statics.findByCategory = function (category, options = {}) {
  const query = {
    category: category.toUpperCase(),
    isActive: true,
  };

  if (options.brand) {
    query.brand = new RegExp(options.brand, "i");
  }

  if (options.minPrice || options.maxPrice) {
    query.sellingPrice = {};
    if (options.minPrice) query.sellingPrice.$gte = options.minPrice;
    if (options.maxPrice) query.sellingPrice.$lte = options.maxPrice;
  }

  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20)
    .populate(
      "availableInStores.storeId",
      "name location.address location.city location.area"
    );
};

// Static method to search products
productSchema.statics.searchProducts = function (searchTerm, options = {}) {
  const query = {
    isActive: true,
    $or: [
      { name: new RegExp(searchTerm, "i") },
      { brand: new RegExp(searchTerm, "i") },
      { model: new RegExp(searchTerm, "i") },
      { sku: new RegExp(searchTerm, "i") },
      { category: new RegExp(searchTerm, "i") },
      { subcategory: new RegExp(searchTerm, "i") },
    ],
  };

  return this.find(query)
    .sort(options.sort || { _id: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20)
    .populate(
      "availableInStores.storeId",
      "name location.address location.city location.area"
    );
};

// Static method to update stock
productSchema.statics.updateStock = async function (
  productId,
  storeId,
  quantity
) {
  const product = await this.findById(productId);
  if (!product) throw new Error("Product not found");

  const storeIndex = product.availableInStores.findIndex(
    (store) => store.storeId.toString() === storeId.toString()
  );

  if (storeIndex !== -1) {
    product.availableInStores[storeIndex].stock = quantity;
    product.availableInStores[storeIndex].lastUpdated = new Date();
  } else {
    product.availableInStores.push({
      storeId: storeId,
      stock: quantity,
      lastUpdated: new Date(),
    });
  }

  // Recalculate overall stock
  product.overallStock = product.availableInStores.reduce(
    (total, store) => total + (store.stock || 0),
    0
  );

  return product.save();
};

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
