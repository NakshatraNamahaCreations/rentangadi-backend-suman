const InventoryModel = require("../model/inventory");
const ProductManagementModel = require("../model/product");
const { parseDate } = require("../utils/dateString");
const moment = require("moment");
const Quotationmodel = require("../model/quotations")
class Inventory {
  async updateInventory(req, res) {
    const { startDate, endDate, products } = req.body;

    console.log("products", products);

    const start = new Date(startDate);
    const end = new Date(endDate);

    try {
      for (const product of products) {
        const { ProductId, qty } = product;

        const pData = await ProductManagementModel.findById(ProductId);

        if (!pData) {
          return res
            .status(404)
            .json({ error: `Product with ID ${ProductId} not found` });
        }

        for (
          let dt = new Date(start);
          dt <= end;
          dt.setDate(dt.getDate() + 1)
        ) {
          const dateKey = new Date(dt);

          const existingEntry = await InventoryModel.findOne({
            productId: ProductId,
            startDate: dateKey,
          });

          if (existingEntry) {
            existingEntry.qty += qty;
            existingEntry.remainingQty += qty;
            await existingEntry.save();
          } else {
            const remainingQty = pData.ProductStock - qty;

            const newOrder = new InventoryModel({
              productId: ProductId,
              startDate: dateKey,
              endDate: dateKey,
              qty: qty,
              remainingQty: remainingQty >= 0 ? remainingQty : 0,
            });

            await newOrder.save();
          }
        }
      }

      res.json({
        success: "Inventory updated successfully for each day in range",
      });
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(500).json({ error: "Failed to update inventory" });
    }
  }

  async getInventoryByDate(req, res) {
    const { date } = req.query;

    try {
      const inventory = await InventoryModel.find({ date: new Date(date) });

      const products = await ProductManagementModel.find().lean();

      const stock = products.map((product) => {
        const inventoryEntry = inventory.find(
          (item) => item.productId.toString() === product._id.toString()
        );

        return {
          productId: product._id,
          productName: product.ProductName,
          totalStock: product.ProductStock,
          availableStock: inventoryEntry
            ? inventoryEntry.availableQty
            : product.ProductStock,
        };
      });

      res.status(200).json({ stock });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch inventory.", error: error.message });
    }
  }

  // async getInventoryByDateSlotProducts(req, res) {
  //   console.log(`inside getInventoryByDateSlotProducts***********`);
  //   const { startDate, endDate, products } = req.query;

  //   console.log("Start Date:", startDate);
  //   console.log("End Date:", endDate);
  //   console.log("products:", products.slice(0, 5), "length: ", products.length);

  //   try {
  //     if (!startDate || !endDate || !products) {
  //       return res.status(400).json({
  //         message: "Start date, end date, and product IDs are required.",
  //       });
  //     }

  //     const productIds = Array.isArray(products)
  //       ? products
  //       : products.split(",");

  //     const start = parseDate(startDate.trim());
  //     const end = parseDate(endDate.trim());
  //     // Step 1: Fetch all inventory records for the given productId(s)
  //     const inventory = await InventoryModel.find({
  //       productId: { $in: productIds }
  //     });

  //     // Step 2: Check for overlapping date ranges
  //     const overlappingInventory = inventory.filter(item => {
  //       // Convert startdate and enddate from strings (e.g., 'DD-MM-YYYY') to Date objects
  //       const inventoryStartDate = parseDate(item.startdate);
  //       const inventoryEndDate = parseDate(item.enddate);

  //       // Check if there's an overlap
  //       return inventoryStartDate <= end && inventoryEndDate >= start;
  //     });

  //     // const inventory = await InventoryModel.find({
  //     //   startdate: { $lte: endDate },
  //     //   enddate: { $gte: startDate },
  //     //   // slot: slot.trim(),
  //     //   productId: { $in: productIds },
  //     // });

  //     const productsData = await ProductManagementModel.find({
  //       _id: { $in: productIds },
  //     }).lean();

  //     const stock = productsData.map((product) => {
  //       const inventoryEntries = overlappingInventory.filter(
  //         (item) => item.productId.toString() === product._id.toString()
  //       );

  //       // const totalReserved = inventoryEntries.reduce(
  //       //   (sum, item) => sum + item.reservedQty,
  //       //   0
  //       // );

  //       // const minAvailableQty =
  //       //   inventoryEntries.length > 0
  //       //     ? Math.min(...inventoryEntries.map((item) => item.availableQty))
  //       //     : product.ProductStock;
  //       // return {
  //       //   productId: product._id,
  //       //   productName: product.ProductName,
  //       //   totalStock: product.ProductStock,
  //       //   reservedStock: totalReserved,
  //       //   availableStock: Math.max(minAvailableQty, 0),
  //       //   // slot: slot,
  //       //   price: product.ProductPrice || 0,
  //       //   StockAvailable: product.StockAvailable,
  //       // };

  //       // console.log("inventoryEntries: ", inventoryEntries)

  //       // Calculate total reserved quantity from the overlapping inventory
  //       const totalReserved = inventoryEntries.reduce(
  //         (sum, entry) => sum + (entry.reservedQty || 0),
  //         0
  //       );

  //       // If there are no overlapping reservations, use the product stock directly
  //       let availableStock = product.ProductStock;

  //       // If there are overlapping reservations, subtract the reserved quantity from the product stock
  //       if (inventoryEntries.length > 0) {
  //         availableStock = Math.max(product.ProductStock - totalReserved, 0); // Ensure no negative stock
  //       }

  //       // console.log(`totalReserved ${product}`, totalReserved)
  //       // console.log(`available stock ${product}`, availableStock )

  //       // Returning the product details with calculated available stock
  //       return {
  //         productId: product._id,
  //         productName: product.ProductName,
  //         totalStock: product.ProductStock,
  //         reservedStock: totalReserved,
  //         availableStock: Math.max(availableStock, 0),  // Ensure available stock doesn't go below 0
  //         price: product.ProductPrice || 0,
  //         StockAvailable: product.StockAvailable,
  //       };

  //     });

  //     res.status(200).json({ stock });
  //   } catch (error) {
  //     console.error("Error fetching inventory:", error);
  //     res
  //       .status(500)
  //       .json({ message: "Failed to fetch inventory.", error: error.message });
  //   }
  // }


  // by sonali //
  async getInventoryByDateSlotProducts(req, res) {
    console.log(`inside getInventoryByDateSlotProducts***********`);
    const { startDate, endDate, products } = req.query;

    try {
      if (!startDate || !endDate || !products) {
        return res.status(400).json({
          message: "Start date, end date, and product IDs are required.",
        });
      }

      const productIds = Array.isArray(products) ? products : products.split(",");

      const start = parseDate(startDate.trim());
      const end = parseDate(endDate.trim());

      // -----------------------------
      // ✅ 1) Your existing confirmed reservation logic
      // -----------------------------
      /* Reading every inventory row for these products meant 8,400 rows off
         Atlas and about fifteen seconds whenever the whole catalogue was
         asked for. The dates are strings, in DD-MM-YYYY for most rows and
         YYYY-MM-DD for some legacy ones, so they are converted here to drop
         the rows that plainly fall outside the window.

         This pre-filter is deliberately wider than the check below: a row
         whose dates will not parse is kept, so the JavaScript filter stays
         the one that decides what overlaps and the figures do not move. */
      const asDate = (field) => ({
        $dateFromString: {
          dateString: "$" + field,
          format: "%d-%m-%Y",
          onError: {
            $dateFromString: {
              dateString: "$" + field,
              format: "%Y-%m-%d",
              onError: null,
            },
          },
        },
      });

      const inventory = await InventoryModel.aggregate([
        { $match: { productId: { $in: productIds } } },
        { $addFields: { _start: asDate("startdate"), _end: asDate("enddate") } },
        {
          $match: {
            $or: [
              { _start: null },
              { _end: null },
              { $and: [{ _start: { $lte: end } }, { _end: { $gte: start } }] },
            ],
          },
        },
        { $project: { _start: 0, _end: 0 } },
      ]);

      const overlappingInventory = inventory.filter((item) => {
        const inventoryStartDate = parseDate(item.startdate);
        const inventoryEndDate = parseDate(item.enddate);
        return inventoryStartDate <= end && inventoryEndDate >= start;
      });

      // -----------------------------
      // ✅ 2) NEW: Pending quotation qty per product (ONLY THIS PART IS NEW)
      // -----------------------------

      // ✅ set this exactly as your DB "pending" value
      // Example: if your pending quotation status is "pending"
      const PENDING_STATUSES = ["pending"]; // change if needed

      // Fetch only pending quotations that contain any of these products
      const pendingQuotes = await Quotationmodel.find({
        status: { $in: PENDING_STATUSES },
        "slots.Products.productId": { $in: productIds },
      })
        .select("quoteId clientId clientName clientNo executivename slots status")
        /* clientNo is blank on a good number of quotations, so the client
           record supplies the phone number as a fallback. */
        .populate({ path: "clientId", select: "phoneNumber name" })
        .lean();

      // Build map: productId -> total pending qty, and alongside it the list
      // of quotations that make up the total, so the screens can show who is
      // holding the stock instead of just how much of it is held.
      const pendingQuoteMap = {};
      const pendingQuoteDetails = {};

      for (const q of pendingQuotes || []) {
        for (const slot of q.slots || []) {
          const slotStart = parseDate(slot.quoteDate);
          const slotEnd = parseDate(slot.endDate);

          // check overlap with requested date range
          if (!slotStart || !slotEnd) continue;
          if (!(slotStart <= end && slotEnd >= start)) continue;

          for (const p of slot.Products || []) {
            const pid = String(p.productId);
            if (!productIds.includes(pid)) continue;

            const qty = Number(p.qty ?? p.quantity ?? 0);
            pendingQuoteMap[pid] = (pendingQuoteMap[pid] || 0) + qty;

            // One entry per slot: the same quotation can hold a product over
            // two separate date ranges, and those are worth telling apart.
            (pendingQuoteDetails[pid] = pendingQuoteDetails[pid] || []).push({
              quotationId: String(q._id),
              quoteId: q.quoteId || "",
              clientName: q.clientName || (q.clientId && q.clientId.name) || "",
              clientNo: q.clientNo || (q.clientId && q.clientId.phoneNumber) || "",
              executivename: q.executivename || "",
              status: q.status || "",
              quoteDate: slot.quoteDate || "",
              endDate: slot.endDate || "",
              qty,
            });
          }
        }
      }

      // -----------------------------
      // ✅ 3) Your existing product stock calculation
      // -----------------------------
      /* Only these four fields reach the response; the rest, images above
         all, were a megabyte of nothing. */
      const productsData = await ProductManagementModel.find({
        _id: { $in: productIds },
      })
        .select("ProductName ProductStock ProductPrice StockAvailable")
        .lean();

      const stock = productsData.map((product) => {
        const inventoryEntries = overlappingInventory.filter(
          (item) => String(item.productId) === String(product._id)
        );

        // const totalReserved = inventoryEntries.reduce(
        //   (sum, entry) => sum + (entry.reservedQty || 0),
        //   0
        // );

        // let availableStock = product.ProductStock;

        // if (inventoryEntries.length > 0) {
        //   availableStock = Math.max(product.ProductStock - totalReserved, 0);
        // }

        // Step 1: Build per-day reservation map
        const dailyReservedMap = {};

        for (const entry of inventoryEntries) {
          const entryStart = parseDate(entry.startdate);
          const entryEnd = parseDate(entry.enddate);

          if (!entryStart || !entryEnd) continue;

          for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split("T")[0];
            dailyReservedMap[key] =
              (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
          }
        }

        // Step 2: Find MAX reserved in any single day
        const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

        // Step 3: Calculate available stock
        const availableStock = Math.max(product.ProductStock - maxReserved, 0);

        const pendingQuotationQty = Number(
          pendingQuoteMap[String(product._id)] || 0
        );

        return {
          productId: product._id,
          productName: product.ProductName,
          totalStock: product.ProductStock,
          reservedStock: maxReserved,
          availableStock,
          pendingQuotationQty,
          pendingQuotations: pendingQuoteDetails[String(product._id)] || [],
          price: product.ProductPrice || 0,
          StockAvailable: product.StockAvailable,
        };
      });

      return res.status(200).json({ stock });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch inventory.", error: error.message });
    }
  }


  async getAvailableStockByProductId(req, res) {
    console.log("➡️ Inside getAvailableStockByProductId");

    const { startDate, endDate, productId } = req.query;
    console.log("startdate: ", startDate)
    console.log("endDate: ", endDate)
    console.log("productId: ", productId)

    try {
      if (!startDate || !endDate || !productId) {
        return res.status(400).json({
          message: "Start date, end date, and productId are required.",
        });
      }

      // this works if startDate fromat is MM/DD/YYYY
      // const start = parseDate(startDate.trim());
      // const end = parseDate(endDate.trim());

      // // if date format is DD/MM/YYYY
      // const start = startDate.trim();
      // const end = endDate.trim();

      const start = moment(startDate, "DD-MM-YYYY");
      const end = moment(endDate, "DD-MM-YYYY");

      console.log("start: ", start)
      console.log("end: ", end)

      // Get the product details
      const product = await ProductManagementModel.findById(productId).lean();
      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }
      // Fetch all inventory for the product
      const inventory = await InventoryModel.find({ productId }).lean();

      // console.log("inventory: ", inventory)

      // Filter inventory overlapping with the requested date range
      const overlappingInventory = inventory.filter(item => {
        const invStart = moment(item.startdate, "DD-MM-YYYY");
        const invEnd = moment(item.enddate, "DD-MM-YYYY");
        console.log("inv : ", invStart, invEnd)

        return invStart.isSameOrBefore(end) && invEnd.isSameOrAfter(start);
      });

      // console.log("overlappingInventory1: ", overlappingInventory1)

      // return

      // // Fetch inventory entries overlapping with the given date range
      // const overlappingInventory = await InventoryModel.find({
      //   productId,
      //   $or: [
      //     { startdate: { $lte: end }, enddate: { $gte: start } },
      //     { startdate: { $lte: start }, enddate: { $gte: start } },
      //   ],
      // });

      // Calculate total reserved quantity from the overlapping inventory
      const totalReserved = overlappingInventory.reduce(
        (sum, entry) => sum + (entry.reservedQty || 0),
        0
      );

      // If there are no overlapping reservations, use the product stock directly
      let availableStock = product.ProductStock;

      // If there are overlapping reservations, subtract the reserved quantity from the product stock
      if (overlappingInventory.length > 0) {
        availableStock = Math.max(product.ProductStock - totalReserved, 0); // Ensure no negative stock
      }

      console.log("overlappingInventory: ", overlappingInventory);
      console.log("available stock: ", availableStock);

      return res.status(200).json({ productId, availableStock });

    } catch (error) {
      console.error("❌ Error in getAvailableStock:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }

  // async getinventorydataprroduct(req, res) {
  //   const { slot, startdate, enddate } = req.body;
  //   console.log(slot, startdate, enddate, "Request Data");

  //   try {
  //     const inventory = await InventoryModel.find({
  //       slot: slot,
  //       startdate: startdate,
  //       enddate: enddate,
  //     }).populate("productId", "ProductName");

  //     if (!inventory) {
  //       return res.status(404).json({ error: "No inventory found" });
  //     }

  //     res.status(200).json({ inventory });
  //   } catch (error) {
  //     console.error("Error fetching inventory by slot/date:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // }

  // async getinventorydataprroduct(req, res) {
  //   const { slot, startdate, enddate } = req.body;
  //   console.log(slot, startdate, enddate, "Request Data");

  //   try {
  //     const allProducts = await ProductManagementModel.find({});
  //     const inventoryList = await InventoryModel.find({
  //       slot,
  //       startdate,
  //       enddate,
  //     });

  //     const inventoryMap = {};
  //     inventoryList.forEach((inv) => {
  //       inventoryMap[inv.productId] = {
  //         reservedQty: inv.reservedQty,
  //         availableQty: inv.availableQty,
  //       };
  //     });

  //     const mergedData = allProducts.map((product) => {
  //       const inventoryData = inventoryMap[product._id.toString()];
  //       return {
  //         ...product._doc,
  //         reservedQty: inventoryData?.reservedQty || 0,
  //         availableQty: inventoryData?.availableQty || 0,
  //       };
  //     });

  //     return res.status(200).json({ inventory: mergedData });
  //   } catch (error) {
  //     console.error("Error merging inventory with products:", error);
  //     res.status(500).json({ error: "Internal Server Error" });
  //   }
  // }

  async getinventorydataprroduct(req, res) {
    const { slot, startdate, enddate } = req.body;
    console.log(slot, startdate, enddate, "Request Data");

    try {
      const allProducts = await ProductManagementModel.find({});
      const inventoryList = await InventoryModel.find({
        slot,
        startdate,
        enddate,
      });

      const inventoryMap = {};
      inventoryList.forEach((inv) => {
        inventoryMap[inv.productId] = {
          reservedQty: inv.reservedQty,
          availableQty: inv.availableQty,
        };
      });

      const mergedData = allProducts.map((product) => {
        const productIdStr = product._id.toString();
        const inventoryData = inventoryMap[productIdStr];

        return {
          ...product._doc,
          reservedQty: inventoryData?.reservedQty || 0,
          availableQty:
            (inventoryData?.availableQty ?? product.StockAvailable) || 0,
        };
      });

      return res.status(200).json({ inventory: mergedData });
    } catch (error) {
      console.error("Error merging inventory with products:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

const inventoryController = new Inventory();
module.exports = inventoryController;

