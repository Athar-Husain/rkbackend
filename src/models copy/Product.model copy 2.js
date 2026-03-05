import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // ------------------ Basic Info ------------------
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
      lowercase: true,
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

    // ------------------ Description ------------------
    description: String,
    highlights: [String],

    // ------------------ Media ------------------
    images: [
      {
        url: String,
        alt: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // ------------------ Specifications ------------------
    specifications: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // ------------------ Pricing ------------------
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },

    // ------------------ Inventory ------------------
    availableInStores: [
      {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
        stock: { type: Number, default: 0 },
        lastUpdated: Date,
      },
    ],
    overallStock: { type: Number, default: 0 },

    // ------------------ Attributes ------------------
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // ------------------ Metadata ------------------
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    keywords: [String],
    slug: { type: String, unique: true, lowercase: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ------------------ Pre-save hook ------------------
productSchema.pre("save", function () {
  if (!this.slug) {
    this.slug = `${this.brand}-${this.model}-${this.sku}`
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  if (this.mrp && this.sellingPrice) {
    this.discountPercentage = Math.round(
      ((this.mrp - this.sellingPrice) / this.mrp) * 100,
    );
  }

  if (this.availableInStores && this.availableInStores.length > 0) {
    this.overallStock = this.availableInStores.reduce(
      (total, store) => total + (store.stock || 0),
      0,
    );
  }
});

// ------------------ Virtuals ------------------
// productSchema.virtual("formattedMRP").get(function () {
//   return `₹${this.mrp.toLocaleString("en-IN")}`;
// });
// productSchema.virtual("formattedSellingPrice").get(function () {
//   return `₹${this.sellingPrice.toLocaleString("en-IN")}`;
// });
// productSchema.virtual("formattedSavings").get(function () {
//   return `₹${(this.mrp - this.sellingPrice).toLocaleString("en-IN")}`;
// });

productSchema.virtual("formattedMRP").get(function () {
  const mrp = this.mrp ?? 0;
  return `₹${Number(mrp).toLocaleString("en-IN")}`;
});

productSchema.virtual("formattedSellingPrice").get(function () {
  const price = this.sellingPrice ?? 0;
  return `₹${Number(price).toLocaleString("en-IN")}`;
});

productSchema.virtual("formattedSavings").get(function () {
  const mrp = this.mrp ?? 0;
  const price = this.sellingPrice ?? 0;
  return `₹${(mrp - price).toLocaleString("en-IN")}`;
});

const Product = mongoose.model("Product", productSchema);
export default Product;
