// const mongoose = require('mongoose');
import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    // Customer Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Store Information
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    staffId: String, // Staff username who processed

    // Items Purchased
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        sku: String,
        name: String,
        category: String,
        brand: String,
        model: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        totalPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        specifications: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
      },
    ],

    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Coupon Used
    couponUsed: {
      userCouponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserCoupon",
      },
      couponCode: String,
      discountApplied: Number,
    },

    // Payment Information
    payment: {
      method: {
        type: String,
        enum: ["CASH", "CARD", "UPI", "CHEQUE", "EMI", "WALLET"],
        default: "CASH",
      },
      transactionId: String,
      status: {
        type: String,
        enum: ["PENDING", "COMPLETED", "FAILED"],
        default: "COMPLETED",
      },
      notes: String,
    },

    // Invoice Details
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    // Delivery/Installation (if applicable)
    delivery: {
      type: {
        type: String,
        enum: ["STORE_PICKUP", "HOME_DELIVERY"],
        default: "STORE_PICKUP",
      },
      address: String,
      scheduledDate: Date,
      status: {
        type: String,
        enum: ["PENDING", "SCHEDULED", "DELIVERED", "INSTALLED"],
        default: "PENDING",
      },
      installationRequired: {
        type: Boolean,
        default: false,
      },
    },

    // Warranty Information
    warranty: {
      period: String, // "1 year", "2 years"
      startDate: Date,
      endDate: Date,
      cardNumber: String,
    },

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "CANCELLED", "REFUNDED"],
      default: "COMPLETED",
    },

    // Customer Feedback
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Generate invoice number before saving
purchaseSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    this.invoiceNumber = `RKINV${year}${month}${random}`;
  }

  // Calculate item totals if not provided
  if (this.items && this.items.length > 0) {
    this.items.forEach((item) => {
      if (!item.totalPrice) {
        item.totalPrice = item.unitPrice * item.quantity;
      }
    });

    // Calculate subtotal
    if (!this.subtotal) {
      this.subtotal = this.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
    }

    // Calculate final amount
    if (!this.finalAmount) {
      this.finalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);
    }
  }

  next();
});

// Virtual for formatted amounts
purchaseSchema.virtual("formattedSubtotal").get(function () {
  return `₹${this.subtotal.toLocaleString("en-IN")}`;
});

purchaseSchema.virtual("formattedDiscount").get(function () {
  return `₹${this.discount.toLocaleString("en-IN")}`;
});

purchaseSchema.virtual("formattedFinalAmount").get(function () {
  return `₹${this.finalAmount.toLocaleString("en-IN")}`;
});

// Virtual for savings percentage
purchaseSchema.virtual("savingsPercentage").get(function () {
  if (this.subtotal === 0) return 0;
  return Math.round((this.discount / this.subtotal) * 100);
});

// Method to add item to purchase
purchaseSchema.methods.addItem = async function (
  productId,
  quantity,
  unitPrice,
) {
  const Product = mongoose.model("Product");
  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  this.items.push({
    productId: product._id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    brand: product.brand,
    model: product.model,
    quantity: quantity,
    unitPrice: unitPrice,
    totalPrice: unitPrice * quantity,
    specifications: product.specifications,
  });

  // Recalculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.finalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0);

  return this.save();
};

// Static method to get user's purchase history
purchaseSchema.statics.getUserHistory = function (userId, options = {}) {
  const query = { userId: userId };

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }

  if (options.storeId) {
    query.storeId = options.storeId;
  }

  return this.find(query)
    .populate("storeId", "name location.address location.city location.area")
    .populate("items.productId", "name category brand model images")
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
};

// Static method to get store's sales report
purchaseSchema.statics.getStoreReport = function (storeId, startDate, endDate) {
  const matchStage = {
    storeId: mongoose.Types.ObjectId(storeId),
    status: "COMPLETED",
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        totalSales: { $sum: "$finalAmount" },
        totalDiscounts: { $sum: "$discount" },
        transactionCount: { $sum: 1 },
        averageTransaction: { $avg: "$finalAmount" },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
  ]);
};

const Purchase = mongoose.model("Purchase", purchaseSchema);
// module.exports = Purchase;
export default Purchase;
