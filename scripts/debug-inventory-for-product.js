/**
 * Diagnostic: dump InventoryModel rows for a single product and highlight
 * which ones overlap a given query window.
 *
 * Usage (from rentangadi-backend/):
 *   node scripts/debug-inventory-for-product.js "Black prism chair" 02-11-2026 04-11-2026
 *   node scripts/debug-inventory-for-product.js <productId> 02-11-2026 04-11-2026
 *
 * Dates must be in DD-MM-YYYY (same format the app uses).
 */

require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment");

const InventoryModel = require("../model/inventory");
const ProductModel = require("../model/product");
const OrderModel = require("../model/order");

async function main() {
  const [, , productArg, startArg, endArg] = process.argv;

  if (!productArg || !startArg || !endArg) {
    console.error(
      'Usage: node scripts/debug-inventory-for-product.js "<productName|productId>" <DD-MM-YYYY start> <DD-MM-YYYY end>'
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  const start = moment(startArg, "DD-MM-YYYY", true);
  const end = moment(endArg, "DD-MM-YYYY", true);
  if (!start.isValid() || !end.isValid()) {
    console.error("Dates must be valid DD-MM-YYYY (e.g. 02-11-2026)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  // Resolve product
  let product = null;
  if (mongoose.isValidObjectId(productArg)) {
    product = await ProductModel.findById(productArg).lean();
  }
  if (!product) {
    product = await ProductModel.findOne({
      ProductName: { $regex: `^${escapeRegex(productArg)}$`, $options: "i" },
    }).lean();
  }
  if (!product) {
    console.error(`No product found matching "${productArg}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const productId = String(product._id);

  console.log("=== Product ===");
  console.log("Name       :", product.ProductName);
  console.log("_id        :", productId);
  console.log("ProductStock:", product.ProductStock);
  console.log("");

  // All inventory rows for the product
  const allRows = await InventoryModel.find({ productId }).lean();

  console.log(`=== InventoryModel rows for this product (${allRows.length} total) ===`);
  if (!allRows.length) {
    console.log("(none)");
  } else {
    for (const row of allRows) {
      const invStart = moment(row.startdate, "DD-MM-YYYY", true);
      const invEnd = moment(row.enddate, "DD-MM-YYYY", true);
      const overlaps =
        invStart.isValid() &&
        invEnd.isValid() &&
        invStart.isSameOrBefore(end) &&
        invEnd.isSameOrAfter(start);
      console.log(
        [
          overlaps ? "OVERLAP" : "       ",
          `_id=${row._id}`,
          `dates=${row.startdate} → ${row.enddate}`,
          `reservedQty=${row.reservedQty}`,
          `availableQty=${row.availableQty}`,
        ].join("  ")
      );
    }
  }
  console.log("");

  // Overlapping rows (same logic as getAvailableStockByProductId)
  const overlapping = allRows.filter((row) => {
    const invStart = moment(row.startdate, "DD-MM-YYYY", true);
    const invEnd = moment(row.enddate, "DD-MM-YYYY", true);
    return (
      invStart.isValid() &&
      invEnd.isValid() &&
      invStart.isSameOrBefore(end) &&
      invEnd.isSameOrAfter(start)
    );
  });

  const naiveSum = overlapping.reduce((s, r) => s + (r.reservedQty || 0), 0);

  // Per-day peak (correct logic used elsewhere in the code)
  const dailyReservedMap = {};
  for (const row of overlapping) {
    const s = moment(row.startdate, "DD-MM-YYYY", true);
    const e = moment(row.enddate, "DD-MM-YYYY", true);
    if (!s.isValid() || !e.isValid()) continue;
    for (let d = s.clone(); d.isSameOrBefore(e); d.add(1, "day")) {
      const key = d.format("YYYY-MM-DD");
      dailyReservedMap[key] = (dailyReservedMap[key] || 0) + (row.reservedQty || 0);
    }
  }
  const peakDay = Object.entries(dailyReservedMap).reduce(
    (best, [k, v]) => (v > best.v ? { k, v } : best),
    { k: null, v: 0 }
  );

  console.log(`=== Query window: ${startArg} → ${endArg} ===`);
  console.log(`Overlapping rows                        : ${overlapping.length}`);
  console.log(`Naive sum of reservedQty (current bug)  : ${naiveSum}`);
  console.log(
    `Peak single-day reservation (correct)   : ${peakDay.v}${
      peakDay.k ? `  (on ${peakDay.k})` : ""
    }`
  );
  console.log(
    `Available (current buggy calc)          : ${Math.max(product.ProductStock - naiveSum, 0)}`
  );
  console.log(
    `Available (peak-day, correct)           : ${Math.max(product.ProductStock - peakDay.v, 0)}`
  );
  console.log("");

  // For each overlapping row, try to find the order it came from
  console.log("=== Orders linked to overlapping InventoryModel rows ===");
  for (const row of overlapping) {
    const orders = await OrderModel.find({
      "slots.products.productId": productId,
      "slots.quoteDate": row.startdate,
      "slots.endDate": row.enddate,
    })
      .select("invoiceId orderStatus clientName createdAt")
      .lean();

    if (!orders.length) {
      console.log(
        `Inventory row ${row._id} (${row.startdate}→${row.enddate}, qty=${row.reservedQty}) — NO matching order (ghost?)`
      );
    } else {
      for (const o of orders) {
        console.log(
          `Inventory row ${row._id} (${row.startdate}→${row.enddate}, qty=${row.reservedQty}) → order ${o.invoiceId} status=${o.orderStatus} client=${o.clientName}`
        );
      }
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch(async (err) => {
  console.error("Script failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
