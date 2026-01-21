// const ExcelJS = require("exceljs");
// const path = require("path");

import ExcelJS from "exceljs";
import path from "path";

// Import products from Excel
export const importProductsFromExcel = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  const products = [];

  // Skip header row
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);

    const product = {
      sku: row.getCell(1).value?.toString().trim(),
      name: row.getCell(2).value?.toString().trim(),
      category: row.getCell(3).value?.toString().trim().toUpperCase(),
      brand: row.getCell(4).value?.toString().trim(),
      model: row.getCell(5).value?.toString().trim(),
      description: row.getCell(6).value?.toString().trim(),
      specifications: JSON.parse(row.getCell(7).value || "{}"),
      mrp: parseFloat(row.getCell(8).value) || 0,
      sellingPrice: parseFloat(row.getCell(9).value) || 0,
      images:
        row
          .getCell(10)
          .value?.toString()
          .split(",")
          .map((img) => img.trim()) || [],
    };

    // Validate required fields
    if (product.sku && product.name && product.category && product.brand) {
      products.push(product);
    }
  }

  return products;
};

// Export users to Excel
export const exportUsersToExcel = async (users) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Users");

  // Add headers
  worksheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Mobile", key: "mobile", width: 15 },
    { header: "Email", key: "email", width: 30 },
    { header: "City", key: "city", width: 20 },
    { header: "Area", key: "area", width: 20 },
    { header: "Registration Date", key: "createdAt", width: 20 },
    { header: "Total Purchases", key: "purchaseCount", width: 15 },
    { header: "Total Spent", key: "totalSpent", width: 15 },
    { header: "Active Coupons", key: "activeCoupons", width: 15 },
  ];

  // Add data
  users.forEach((user) => {
    worksheet.addRow({
      name: user.name,
      mobile: user.mobile,
      email: user.email || "",
      city: user.city,
      area: user.area,
      createdAt: new Date(user.createdAt).toLocaleDateString("en-IN"),
      purchaseCount: user.purchaseCount || 0,
      totalSpent: user.totalSpent
        ? `₹${user.totalSpent.toLocaleString("en-IN")}`
        : "₹0",
      activeCoupons: user.activeCoupons || 0,
    });
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Generate file
  const fileName = `users_export_${Date.now()}.xlsx`;
  const filePath = path.join(__dirname, "../exports", fileName);

  await workbook.xlsx.writeFile(filePath);
  return { fileName, filePath };
};

// Export sales report to Excel
export const exportSalesReportToExcel = async (salesData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  // Add headers
  worksheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Invoice No", key: "invoiceNumber", width: 20 },
    { header: "Customer", key: "customerName", width: 25 },
    { header: "Store", key: "storeName", width: 25 },
    { header: "Products", key: "products", width: 40 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Subtotal", key: "subtotal", width: 15 },
    { header: "Discount", key: "discount", width: 15 },
    { header: "Final Amount", key: "finalAmount", width: 15 },
    { header: "Payment Method", key: "paymentMethod", width: 15 },
  ];

  // Add data
  salesData.forEach((sale) => {
    worksheet.addRow({
      date: new Date(sale.createdAt).toLocaleDateString("en-IN"),
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.userId?.name || "N/A",
      storeName: sale.storeId?.name || "N/A",
      products: sale.items
        .map((item) => `${item.name} (${item.quantity})`)
        .join(", "),
      quantity: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: `₹${sale.subtotal.toLocaleString("en-IN")}`,
      discount: `₹${sale.discount.toLocaleString("en-IN")}`,
      finalAmount: `₹${sale.finalAmount.toLocaleString("en-IN")}`,
      paymentMethod: sale.payment?.method || "CASH",
    });
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add summary row
  const lastRow = worksheet.rowCount + 2;
  worksheet.getCell(`A${lastRow}`).value = "TOTAL";
  worksheet.getCell(`A${lastRow}`).font = { bold: true };

  const totalAmount = salesData.reduce(
    (sum, sale) => sum + sale.finalAmount,
    0,
  );
  const totalDiscount = salesData.reduce((sum, sale) => sum + sale.discount, 0);

  worksheet.getCell(`H${lastRow}`).value = `₹${totalDiscount.toLocaleString(
    "en-IN",
  )}`;
  worksheet.getCell(`H${lastRow}`).font = { bold: true };

  worksheet.getCell(`I${lastRow}`).value = `₹${totalAmount.toLocaleString(
    "en-IN",
  )}`;
  worksheet.getCell(`I${lastRow}`).font = { bold: true };

  // Generate file
  const fileName = `sales_report_${Date.now()}.xlsx`;
  const filePath = path.join(__dirname, "../exports", fileName);

  await workbook.xlsx.writeFile(filePath);
  return { fileName, filePath };
};
