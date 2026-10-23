const mongoose = require("mongoose");
const Quotationmodel = require("../model/quotations");
const listCache = require("../utils/listCache");
const NodeCache = require("node-cache");
const ProductModel = require("../model/product");
const InventoryModel = require("../model/inventory");
const Counter = require("../model/getNextSequence");
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });
const moment = require("moment");
const { parseDate } = require("../utils/dateString");
const Enquirymodel = require("../model/enquiry");
const dayjs = require('dayjs'); // Import Day.js
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat); // To support custom date formats like 'DD-MM-YYYY'


class Quotations {
  // async createQuotations(req, res) {
  //     const session = await mongoose.startSession();
  //     session.startTransaction();

  //     try {
  //         const {
  //             clientId,
  //             quoteDate,
  //             endDate,
  //             quoteTime,
  //             clientName,
  //             clientNo,
  //             address,
  //             Products,
  //             category,
  //             status,
  //             GrandTotal,
  //             adjustments,
  //             discount,
  //             termsandCondition,
  //             GST,
  //             executivename,
  //             placeaddress,
  //             slots,
  //         } = req.body;

  //         // Generate the next quotation ID
  //         const latestQuotation = await Quotationmodel.findOne()
  //             .sort({ _id: -1 })
  //             .session(session);
  //         const nextQuoteId = latestQuotation
  //             ? `QT${(parseInt(latestQuotation.quoteId.replace("QT", ""), 10) + 1)
  //                 .toString()
  //                 .padStart(4, "0")}`
  //             : "QT0001";

  //         // Create the new quotation
  //         const newQuotation = new Quotationmodel({
  //             clientId,
  //             quoteId: nextQuoteId,
  //             clientName,
  //             Products,
  //             clientNo,
  //             address,
  //             category,
  //             quoteDate,
  //             quoteTime,
  //             termsandCondition,
  //             GrandTotal,
  //             adjustments,
  //             discount,
  //             GST,
  //             status,
  //             executivename,
  //             endDate,
  //             placeaddress,
  //             slots,
  //         });

  //         const savedQuotation = await newQuotation.save({ session });

  //         // Update inventory for slots and products
  //         for (const slot of slots) {
  //             const { Products, slotName } = slot;

  //             for (const product of Products) {
  //                 const { productId, quantity, StockAvailable } = product;

  //                 // Fetch overlapping reservations for the requested date range and slot
  //                 const overlappingReservations = await InventoryModel.find({
  //                     productId,
  //                     $or: [
  //                         {
  //                             startdate: { $lte: endDate },
  //                             enddate: { $gte: quoteDate },
  //                         },
  //                     ],
  //                     slot: slotName,
  //                 }).session(session);

  //                 // Calculate total reserved inventory during the requested slot
  //                 let totalReservedQty = overlappingReservations.reduce(
  //                     (sum, reservation) => sum + reservation.reservedQty,
  //                     0
  //                 );

  //                 // Calculate available stock based on reservations
  //                 const availableStock = StockAvailable - totalReservedQty;

  //                 if (availableStock < quantity) {
  //                     throw new Error(
  //                         `Insufficient stock for product: ${product.productName} in slot: ${slotName}. Only ${availableStock} available due to overlapping reservations.`
  //                     );
  //                 }

  //                 // Update or create inventory for the current slot
  //                 const existingInventory = await InventoryModel.findOne({
  //                     productId,
  //                     startdate: quoteDate,
  //                     enddate: endDate,
  //                     slot: slotName,
  //                 }).session(session);

  //                 if (existingInventory) {
  //                     existingInventory.reservedQty += quantity;
  //                     existingInventory.availableQty = availableStock - quantity;
  //                     await existingInventory.save({ session });
  //                 } else {
  //                     const newInventory = new InventoryModel({
  //                         productId,
  //                         startdate: quoteDate,
  //                         enddate: endDate,
  //                         slot: slotName,
  //                         reservedQty: quantity,
  //                         availableQty: availableStock - quantity,
  //                     });

  //                     await newInventory.save({ session });
  //                 }
  //             }
  //         }

  //    // Commit the transaction
  //    await session.commitTransaction();
  //    session.endSession();

  //    return res.json({ success: "Quotation created and inventory updated successfully" });
  // } catch (error) {
  //    // Abort the transaction in case of an error
  //    await session.abortTransaction();
  //    session.endSession();
  //    console.error("Error creating quotation:", error);
  //    return res.status(500).json({ error: error.message || "Failed to create Quotation" });
  // }
  // }
  // correct
  async createQuotations(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        enquiryObjectId,
        enquiryId,
        userId,
        clientId,
        executiveId,
        quoteDate,
        endDate,
        quoteTime,
        clientName,
        clientNo,
        address,
        Products,
        category,
        status,
        GrandTotal,
        labourecharge,
        transportcharge,
        inchargeName,
        inchargePhone,
        adjustments,
        discount,
        termsandCondition,
        GST,
        executivename,
        placeaddress,
        slots,
      } = req.body;
      console.log({
        enquiryObjectId,
        enquiryId,
        userId,
        clientId,
        executiveId,
        quoteDate,
        endDate,
        quoteTime,
        clientName,
        clientNo,
        address,
        Products,
        category,
        status,
        GrandTotal,
        labourecharge,
        transportcharge,
        inchargeName,
        inchargePhone,
        adjustments,
        discount,
        termsandCondition,
        GST,
        executivename,
        placeaddress,
        slots,
      });

      // Guard: an enquiry can only be converted to a quotation once. The
      // schema has a unique index on enquiryId, so without this check the
      // second click surfaces a raw Mongo E11000 in the UI. Pre-check
      // here so we can return a friendly message and avoid burning a
      // quoteId sequence number.
      if (enquiryId !== undefined && enquiryId !== null && enquiryId !== "") {
        const existingQuote = await Quotationmodel.findOne({ enquiryId })
          .select("quoteId enquiryId")
          .session(session);
        if (existingQuote) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            error: `A quotation for this enquiry already exists (${existingQuote.quoteId}).`,
            existingQuoteId: existingQuote.quoteId,
          });
        }
      }

      // Generate the next quotation ID
      const latestQuotation = await Quotationmodel.findOne()
        .sort({ _id: -1 })
        .session(session);
      // const nextQuoteId = latestQuotation
      //   ? `QT${(parseInt(latestQuotation.quoteId.replace("QT", ""), 10) + 1)
      //     .toString()
      //     .padStart(4, "0")}`
      //   : "QT0001";

      const nextQuoteSeq = await Counter.getNextSequence("quoteId");
      const nextQuoteId = `QT${nextQuoteSeq.toString().padStart(4, "0")}`;


      console.log(`nextQuoteId: `, nextQuoteId);

      let updatedExecutiveId = executiveId;
      if (executiveId === "") {
        updatedExecutiveId = null;
      }

      //------calc grand total and saving to DB

      if (!slots[0].Products || slots[0].Products.length === 0) {
        return res.status(400).json({ message: 'Products data is missing or empty' });
      }

      // Backfill missing / "Unnamed Product" names from the product master so
      // downstream consumers (orders, invoices, PDF exports) see the real name.
      const collectIds = (arr) =>
        (arr || [])
          .map((p) => p?.productId)
          .filter((id) => id && mongoose.isValidObjectId(id));
      const idsToLookup = new Set([
        ...collectIds(Products),
        ...slots.flatMap((s) => collectIds(s?.Products)),
      ]);
      if (idsToLookup.size) {
        const masterProducts = await ProductModel.find({
          _id: { $in: Array.from(idsToLookup) },
        }).session(session);
        const nameById = new Map(
          masterProducts.map((mp) => [String(mp._id), mp.ProductName])
        );
        const needsName = (p) =>
          !p?.productName ||
          !String(p.productName).trim() ||
          p.productName === "Unnamed Product";
        const applyName = (p) => {
          if (p && needsName(p)) {
            const resolved = nameById.get(String(p.productId));
            if (resolved) p.productName = resolved;
          }
        };
        (Products || []).forEach(applyName);
        slots.forEach((s) => (s?.Products || []).forEach(applyName));
      }

      const daysDiff = (() => {
        const start = quoteDate ? moment(quoteDate, "DD-MM-YYYY", true) : null;
        const end = endDate ? moment(endDate, "DD-MM-YYYY", true) : null;
        if (start && end && start.isValid() && end.isValid()) {
          return Math.max(1, end.diff(start, 'days') + 1);
        }
        return 1;
      })();

      // Calculate the total for all products
      const allProductTotal = daysDiff * slots[0].Products.reduce(
        (sum, p) => (p.productId ? sum + (p.qty * p.price) : sum),
        0
      );

      // console.log(`allProductTotal: `, allProductTotal);


      // Calculate the discount amount
      const discountAmt = allProductTotal * (Number(discount || 0) / 100);

      // Calculate subtotal before GST (Total amount after discount, before GST and additional charges)
      const subtotalBeforeGST = allProductTotal - discountAmt;

      // Add manpower and transport charges
      const totalBeforeCharges = subtotalBeforeGST + Number(labourecharge || 0) + Number(transportcharge || 0);

      // Calculate GST
      const gstAmt = totalBeforeCharges * (Number(GST || 0) / 100);

      // Calculate the grand total (Total after charges + GST + rounding)
      const calculatedGrandTotal = Math.round(totalBeforeCharges + gstAmt);

      //------


      // Create the new quotation
      const newQuotation = new Quotationmodel({
        enquiryId,
        userId,
        clientId,
        executiveId: updatedExecutiveId,
        quoteId: nextQuoteId,
        clientName,
        Products,
        clientNo,
        address,
        category,
        quoteDate,
        quoteTime,
        termsandCondition,
        labourecharge,
        transportcharge,
        inchargeName,
        inchargePhone,
        GrandTotal: calculatedGrandTotal,
        adjustments,
        discount,
        GST,
        status,
        executivename,
        endDate,
        placeaddress,
        slots,
      });

      console.log()

      const savedQuotation = await newQuotation.save({ session });

      // Update inventory for slots and products
      for (const slot of slots) {
        const { Products } = slot;

        for (const product of Products) {
          const { productId, quantity, StockAvailable } = product;
          console.log(productId, quantity, StockAvailable, "HHH")

          const start = parseDate(quoteDate.trim());
          const end = parseDate(endDate.trim());
          // Step 1: Fetch all inventory records for the given productId(s)
          const inventory = await InventoryModel.find({
            productId
          });

          // Step 2: Check for overlapping date ranges
          const overlappingInventory = inventory.filter(item => {
            // Convert startdate and enddate from strings (e.g., 'DD-MM-YYYY') to Date objects
            const inventoryStartDate = parseDate(item.startdate);
            const inventoryEndDate = parseDate(item.enddate);

            // Check if there's an overlap
            return inventoryStartDate <= end && inventoryEndDate >= start;
          });

          // Build per-day reservation map (peak-day logic, not sum across overlaps)
          const dailyReservedMap = {};
          for (const entry of overlappingInventory) {
            const entryStart = parseDate(entry.startdate);
            const entryEnd = parseDate(entry.enddate);
            if (!entryStart || !entryEnd) continue;
            for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().split("T")[0];
              dailyReservedMap[key] =
                (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
            }
          }
          const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

          // Calculate available stock based on peak single-day reservations
          const availableStock = Math.max(StockAvailable - maxReserved, 0);

          if (availableStock < quantity) {
            throw new Error(
              `Insufficient stock for product: ${product.productName} in slot: ${slotName}. Only ${availableStock} available for the requested date range: ${quoteDate} to ${endDate}, due to overlapping reservations.`
            );
          }

          console.log("enquiryObjectId: ", enquiryObjectId)

          // check this out later
          const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(enquiryObjectId) },
            { status: 'sent' },
            { new: true }
          ).session(session);

          // if (!updatedEnquiry) {
          //   console.log('Enquiry not found');
          //   return null;
          // }


          // // Update or create inventory for the current slot
          // const existingInventory = await InventoryModel.findOne({
          //   productId,
          //   startdate: quoteDate,
          //   enddate: endDate,
          //   // slot: slotName,
          // }).session(session);

          // if (existingInventory) {
          //   existingInventory.reservedQty += quantity;
          //   existingInventory.availableQty = availableStock - quantity;
          //   await existingInventory.save({ session });
          // } else {
          //   const newInventory = new InventoryModel({
          //     productId,
          //     startdate: quoteDate,
          //     enddate: endDate,
          //     // slot: slotName,
          //     reservedQty: quantity,
          //     availableQty: availableStock - quantity,
          //   });

          //   await newInventory.save({ session });
          // }
          // Now update the product's StockAvailable
          // const getProduct = await ProductModel.findById(productId).session(session);
          // console.log(`focus product: `, getProduct);

          // if (getProduct) {
          //   getProduct.StockAvailable -= quantity;
          //   await getProduct.save({ session });
          // }
          // const updatedProduct = await ProductModel.findById(productId).session(session)
          // console.log(`after prod updation: `, updatedProduct);
        }
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return res.json({
        success: "Quotation created and inventory updated successfully",
      });
    } catch (error) {
      // Abort the transaction in case of an error
      await session.abortTransaction();
      session.endSession();
      console.error("Error creating quotation:", error);

      // Race fallback: two clicks landed after the pre-check but before
      // the save. Mongo's unique index still catches it; translate the
      // raw E11000 into the same friendly message.
      if (error && error.code === 11000 && error.keyPattern && error.keyPattern.enquiryId) {
        return res.status(409).json({
          error: "A quotation for this enquiry already exists.",
        });
      }

      return res
        .status(500)
        .json({ error: error.message || "Failed to create Quotation" });
    }
  }
  // 15-03-25


  async updateQuotationById(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { quotationId } = req.params;
      const {
        labourecharge,
        transportcharge,
        refurbishment,
        discount,
        slots,
        GrandTotal
      } = req.body;
      console.log({
        labourecharge,
        transportcharge,
        refurbishment,
        discount,
        slots,
        GrandTotal
      });

      const quotation = await Quotationmodel.findById(quotationId).session(session);
      if (!quotation) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Quotation not found" });
      }

      const quoteDate = quotation.quoteDate;
      const endDate = quotation.endDate;
      if (!quoteDate || !endDate) {
        throw new Error("Quotation dates are missing. Cannot validate inventory.");
      }

      if (!Array.isArray(slots)) {
        throw new Error("Slots must be a valid array");
      }

      // Validate inventory for all provided slots/products
      if (slots.length !== 0) {
        const { Products = [] } = slots[0];
        for (const product of Products) {
          const { productId, quantity } = product;
          if (!productId) {
            throw new Error("Product productId is required in slots.Products");
          }

          const productDetails = await ProductModel.findById(productId).lean();
          if (!productDetails) {
            throw new Error(`Product not found: ${productId}`);
          }

          const start = parseDate(String(quoteDate).trim());
          const end = parseDate(String(endDate).trim());

          const inventory = await InventoryModel.find({ productId }).session(session);
          const overlappingInventory = inventory.filter((item) => {
            const inventoryStartDate = parseDate(item.startdate);
            const inventoryEndDate = parseDate(item.enddate);
            return inventoryStartDate <= end && inventoryEndDate >= start;
          });

          // Build per-day reservation map (peak-day logic, not sum across overlaps)
          const dailyReservedMap = {};
          for (const entry of overlappingInventory) {
            const entryStart = parseDate(entry.startdate);
            const entryEnd = parseDate(entry.enddate);
            if (!entryStart || !entryEnd) continue;
            for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().split("T")[0];
              dailyReservedMap[key] =
                (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
            }
          }
          const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

          const baseStock = Number(productDetails.ProductStock) || 0;
          const availableStock = Math.max(baseStock - maxReserved, 0);

          if (Number(quantity) > availableStock) {
            throw new Error(
              // `Insufficient stock for product: ${productDetails.ProductName || productId}. Requested: ${quantity}, Available: ${availableStock} for ${quoteDate} to ${endDate}.`
              `Insufficient stock for product: ${productDetails.ProductName || productId}.`
            );
          }
        }
        // Update slots/products (replace with provided slots)
        if (Array.isArray(slots)) {
          // console.log(`slots[0].Products: `, slots[0].Products);
          slots[[0]].Products.forEach((product, index) => {
            const quoteDate = dayjs(product.productQuoteDate, 'DD-MM-YYYY', true);
            const endDate = dayjs(product.productEndDate, 'DD-MM-YYYY', true);

            // console.log(`quoteDate: `, quoteDate, `endDate: `, endDate);
            // console.log(quoteDate.format('YYYY-MM-DD'));
            // console.log(endDate.format('YYYY-MM-DD'));

            if (!quoteDate.isValid() || !endDate.isValid()) {
              // throw new Error(`Invalid date format in product "${product.productName}" at index ${index}`);
              throw new Error(`Invalid date format in product "${product.productName}".`);
            }

            if (quoteDate.isAfter(endDate)) {
              throw new Error(
                // `Invalid date range for product "${product.productName}" at index ${index}: productQuoteDate (${product.productQuoteDate}) must be before productEndDate (${product.productEndDate}).`
                // `Invalid date range for product "${product.productName}" QuoteDate (${product.productQuoteDate}) must be before EndDate (${product.productEndDate}).`
                `Invalid date range for product "${product.productName}".`
              );
            }
          });

          quotation.slots = slots;
        }
      }

      // Apply field updates
      if (labourecharge !== undefined) quotation.labourecharge = labourecharge;
      if (transportcharge !== undefined) quotation.transportcharge = transportcharge;
      if (refurbishment !== undefined) quotation.refurbishment = refurbishment;
      if (discount !== undefined) quotation.discount = discount;
      if (GrandTotal !== undefined) quotation.GrandTotal = GrandTotal;



      await quotation.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.json({ success: "Quotation updated successfully", data: quotation });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error updated quotation:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to updated Quotation" });
    }
  }

  async getTotalAndTodayQuotationCount(req, res) {
    try {
      // Get the current date and set the time to the start of the day
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Get the current date and set the time to the end of the day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Count the total number of documents
      let totalQuotationCount = await Quotationmodel.countDocuments({});

      // Count the number of documents created today
      let todayQuotationCount = await Quotationmodel.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      });

      return res.json({
        totalQuotationCount: totalQuotationCount,
        todayQuotationCount: todayQuotationCount,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve quotation counts" });
    }
  }

  async updatequotefollowup(req, res) {
    let { followupStatus } = req.body;
    let quoteId = req.params.id;

    try {
      const quoteData = await Quotationmodel.findOneAndUpdate(
        { _id: quoteId },
        { followupStatus: followupStatus }
      );

      if (quoteData) {
        return res.status(200).json({ success: "updated succesfully" });
      }
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async getquotationaggredata(req, res) {
    const id = req.params.id;

    try {
      const Data = await Quotationmodel.find({ _id: id });

      if (Data.length > 0) {
        return res.json({ QuotationData: Data });
      } else {
        return res.status(404).json({ error: "No data found" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to retrieve data" });
    }
  }

  // async allquotations(req, res) {
  //     try {
  //         // Fetch all quotations as plain JavaScript objects
  //         const quoteData = await Quotationmodel.find({}).sort({ _id: -1 }).lean();

  //         // Loop through each quotation to enrich slots with inventory data
  //         const enrichedQuotations = await Promise.all(
  //             quoteData.map(async (quote) => {
  //                 const enrichedSlots = await Promise.all(
  //                     quote.slots.map(async (slot) => {
  //                         const enrichedProducts = await Promise.all(
  //                             slot.Products.map(async (product) => {
  //                                 // Fetch overlapping inventory for the product, slot, and date range
  //                                 const overlappingReservations = await InventoryModel.find({
  //                                     productId: product.productId,
  //                                     $or: [
  //                                         {
  //                                             startdate: { $lte: quote.endDate },
  //                                             enddate: { $gte: quote.quoteDate },
  //                                         },
  //                                     ],
  //                                     slot: slot.slotName,
  //                                 });

  //                                 // Calculate total reserved inventory
  //                                 const totalReservedQty = overlappingReservations.reduce(
  //                                     (sum, reservation) => sum + reservation.reservedQty,
  //                                     0
  //                                 );

  //                                 const availableStock =
  //                                     product.StockAvailable - totalReservedQty;

  //                                 // Determine status
  //                                 let status = "Not Available";
  //                                 if (availableStock > 0) {
  //                                     status = "Available";
  //                                 } else if (totalReservedQty >= product.StockAvailable) {
  //                                     status = "Booked";
  //                                 }

  //                                 return {
  //                                     ...product,
  //                                     availableStock,
  //                                     status,
  //                                 };
  //                             })
  //                         );

  //                         // Check if the slot has at least one available product
  //                         const hasAvailableProducts = enrichedProducts.some(
  //                             (product) => product.status === "Available"
  //                         );

  //                         return {
  //                             ...slot,
  //                             Products: enrichedProducts,
  //                             status: hasAvailableProducts ? "Available" : "Not Available",
  //                         };
  //                     })
  //                 );

  //                 return {
  //                     ...quote,
  //                     slots: enrichedSlots,
  //                 };
  //             })
  //         );

  //         return res.status(200).json({ quoteData: enrichedQuotations });
  //     } catch (error) {
  //         console.error("Something went wrong", error);
  //         return res.status(500).json({ error: "Internal server error" });
  //     }
  // }

  /* Only the scalar fields are read by the list, the calendar, the
     dashboard and the global search. ?full=1 returns every field,
     ?limit / ?page paginate. */
  async allquotations(req, res) {
    try {
      const limit = Math.max(0, parseInt(req.query.limit, 10) || 0);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const full = String(req.query.full || "") === "1";
      const LIST_FIELDS =
        "quoteId clientName clientNo quoteDate quoteTime endDate " +
        "executivename GrandTotal GST status createdAt discount " +
        "inchargeName labourecharge transportcharge";

      /* Only the plain call is cached; paginated ones are already fast. */
      const isDefaultCall = !limit && !full;
      if (isDefaultCall) {
        const hit = listCache.get(listCache.KEYS.quotations);
        if (hit) return res.status(200).json({ quoteData: hit });
      }

      const query = Quotationmodel.find({}).sort({ _id: -1 });
      if (!full) query.select(LIST_FIELDS);
      if (limit > 0) query.skip((page - 1) * limit).limit(limit);
      const quoteData = await query.lean();
      if (isDefaultCall) listCache.set(listCache.KEYS.quotations, quoteData);

      // // Loop through each quotation to enrich slots with inventory data
      // const enrichedQuotations = await Promise.all(quoteData.map(async (quote) => {
      //   const enrichedSlots = await Promise.all(quote.slots.map(async (slot) => {
      //     const enrichedProducts = await Promise.all(slot.Products.map(async (product) => {
      //       // Fetch product details including ProductIcon
      //       const productDetails = await ProductModel.findOne({ _id: product.productId }).lean();

      //       // Fetch overlapping inventory for the product, slot, and date range
      //       const overlappingReservations = await InventoryModel.find({
      //         productId: product.productId,
      //         $or: [
      //           {
      //             startdate: { $lte: quote.endDate },
      //             enddate: { $gte: quote.quoteDate },
      //           },
      //         ],
      //         slot: slot.slotName,
      //       });

      //       // Calculate total reserved inventory
      //       const totalReservedQty = overlappingReservations.reduce(
      //         (sum, reservation) => sum + reservation.reservedQty,
      //         0
      //       );

      //       const availableStock =
      //         product.StockAvailable - totalReservedQty;

      //       // Determine status
      //       let status = "Not Available";
      //       if (availableStock > 0) {
      //         status = "Available";
      //       } else if (totalReservedQty >= product.StockAvailable) {
      //         status = "Booked";
      //       }

      //       // Get only essential product details including ProductIcon
      //       const essentialProduct = {
      //         productId: product.productId,
      //         productName: product.productName || product.name,
      //         price: product.price,
      //         quantity: product.quantity || product.qty,
      //         total: product.total,
      //         ProductIcon: productDetails?.ProductIcon || null,
      //         availableStock,
      //         status
      //       };

      //       return essentialProduct;
      //     }));

      //     // Check if the slot has at least one available product
      //     const hasAvailableProducts = enrichedProducts.some(
      //       (product) => product.status === "Available"
      //     );

      //     return {
      //       ...slot,
      //       Products: enrichedProducts,
      //       status: hasAvailableProducts ? "Available" : "Not Available",
      //     };
      //   })
      //   );

      //   return {
      //     ...quote,
      //     slots: enrichedSlots,
      //   };
      // })
      // );      

      // return res.status(200).json({ quoteData: enrichedQuotations });
      return res.status(200).json({ quoteData });
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async getMyQuotations(req, res) {
    const { userId } = req.params;

    try {
      let data = await Quotationmodel.find({ userId }).sort({ _id: -1 });
      const total = await Quotationmodel.countDocuments({ userId });
      // console.log(data,"Data nhi")
      if (data) {
        return res.json({ total, orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async getQuotationById(req, res) {
    try {
      const { quotationId } = req.params;
      const quote = await Quotationmodel.findById(quotationId).lean();

      // Null-check must run BEFORE any property access — the earlier
      // console.logs crashed on null and surfaced as a 500 to the UI
      // (which then rendered "Quotation not found." for the wrong reason).
      if (!quote) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      console.log("quote._id: ", quote._id);
      console.log("Products: ", quote.slots?.[0]?.Products);

      const enrichedSlots = await Promise.all(
        (quote.slots || []).map(async (slot) => {
          const enrichedProducts = await Promise.all(
            (slot.Products || []).map(async (product) => {
              const productDetails = await ProductModel.findOne({
                _id: product.productId,
              }).lean();

              const overlappingReservations = await InventoryModel.find({
                productId: product.productId,
                $or: [
                  {
                    startdate: { $lte: quote.endDate },
                    enddate: { $gte: quote.quoteDate },
                  },
                ],
                slot: slot.slotName,
              });
              console.log("overlapping invent: ", overlappingReservations)

              // const totalAvaiableQty = overlappingReservations.reduce(
              //   (sum, reservation) => sum + reservation.availableQty,
              //   0
              // );

              // new
              // const totalAvaiableQty = overlappingReservations.length > 0
              //   ? overlappingReservations.reduce((sum, reservation) => sum + reservation.availableQty, 0)
              //   : productDetails?.ProductStock || 0;  // Use default stock from productDetails if no overlapping

              // console.log("total avail: ", totalAvaiableQty)

              // Build per-day reservation map (peak-day logic, not sum across overlaps)
              const dailyReservedMap = {};
              for (const entry of overlappingReservations) {
                const entryStart = parseDate(entry.startdate);
                const entryEnd = parseDate(entry.enddate);
                if (!entryStart || !entryEnd) continue;
                for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
                  const key = d.toISOString().split("T")[0];
                  dailyReservedMap[key] =
                    (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
                }
              }
              const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));
              const availableStock = Math.max(
                (productDetails?.ProductStock || 0) - maxReserved,
                0
              );

              // const stockAvailable = product.stock || 0;
              // const availableStock = stockAvailable - totalReservedQty;
              // const availableStock = productDetails?.ProductStock - totalReservedQty;


              // let status = "Not Available";
              // if (availableStock > 0) {
              //   status = "Available";
              // } else if (stockAvailable > 0 && totalReservedQty >= stockAvailable) {
              //   status = "Booked";
              // }

              // console.log("availableStock: ", availableStock)

              return {
                productId: product.productId,
                productName: product.productName || product.name || productDetails?.ProductName || "Unnamed Product",
                // If the master product was deleted, productDetails is null.
                // Fall back to the price stored on the quotation itself
                // rather than crashing the whole response and hiding the
                // entire quotation behind "Quotation not found".
                price: productDetails?.ProductPrice ?? product.price ?? 0,
                quantity: product.quantity || product.qty,
                total: product.total,
                ProductIcon: productDetails?.ProductIcon || null,
                productQuoteDate: product.productQuoteDate,
                productEndDate: product.productEndDate,
                productSlot: product.productSlot,
                // availableStock: totalAvaiableQty,
                availableStock,
                // status,
              };
            })
          );

          const hasAvailableProducts = enrichedProducts.some(
            (product) => product.status === "Available"
          );

          return {
            ...slot,
            Products: enrichedProducts,
            status: hasAvailableProducts ? "Available" : "Not Available",
          };
        })
      );

      return res.status(200).json({
        quoteData: {
          ...quote,
          slots: enrichedSlots,
        },
      });
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateQuotationOnOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        enquiryObjectId,
        enquiryId,
        Products,
        GrandTotal,
        slots,
      } = req.body;

      console.log({ enquiryId, Products, GrandTotal, slots });

      const existingQuotation = await Quotationmodel.findOne({ enquiryId });

      if (!existingQuotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      const { quoteDate, endDate } = existingQuotation;

      if (!quoteDate || !endDate) {
        throw new Error("Quotation dates are missing. Cannot proceed with inventory update.");
      }

      if (!Array.isArray(Products)) {
        return res.status(400).json({ error: "Products must be a valid array" });
      }
      console.log("before updatedslots")

      // ✅ 1. Update nested slot products with new qty, price, and total
      const updatedSlots = existingQuotation.slots.map((slot, slotIdx) => {
        if (slots && slots[slotIdx]) {
          return {
            ...slot.toObject(),
            Products: slot.Products.map((prod) => {
              const updatedProduct = Products.find(
                (product) => product.productId === prod.productId
              );

              if (updatedProduct) {
                return {
                  ...prod,
                  qty: updatedProduct.qty || prod.qty,
                  price: updatedProduct.price || prod.price,
                  total: updatedProduct.qty * (updatedProduct.price || prod.price),
                };
              }

              return prod;
            }),
          };
        }
        return slot;
      });

      console.log("updatede slots: ", updatedSlots)

      // 2. Save updated data into quotation
      existingQuotation.slots = updatedSlots;
      if (GrandTotal) existingQuotation.GrandTotal = GrandTotal;

      await existingQuotation.save({ session });

      // 3. Inventory check and reservation
      for (const slot of slots) {
        const { Products: slotProducts } = slot;

        for (const product of slotProducts) {
          const { productId, quantity, StockAvailable, productName } = product;
          console.log("product: ", product)

          const start = parseDate(quoteDate.trim());
          const end = parseDate(endDate.trim());

          const inventory = await InventoryModel.find({ productId });

          const overlappingInventory = inventory.filter(item => {
            const inventoryStartDate = parseDate(item.startdate);
            const inventoryEndDate = parseDate(item.enddate);
            return inventoryStartDate <= end && inventoryEndDate >= start;
          });

          console.log(`overlap for prod-> ${productName}: `, overlappingInventory)

          // Build per-day reservation map (peak-day logic, not sum across overlaps)
          const dailyReservedMap = {};
          for (const entry of overlappingInventory) {
            const entryStart = parseDate(entry.startdate);
            const entryEnd = parseDate(entry.enddate);
            if (!entryStart || !entryEnd) continue;
            for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().split("T")[0];
              dailyReservedMap[key] =
                (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
            }
          }
          const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));
          const baseStock = Number(StockAvailable) || 0;
          const availableStock = Math.max(baseStock - maxReserved, 0);
          console.log(`maxReserved for prod->${productName}: `, maxReserved)

          if (Number(quantity) > availableStock) {
            throw new Error(
              `Insufficient stock for product: ${productName}. Only ${availableStock} available for date range ${quoteDate} to ${endDate}.`
            );
          }

          // Optional: Update enquiry status
          // await Quotationmodel.updateOne(
          //   {
          //     enquiryId: enquiryId,
          //     "slots._id": slotId,
          //     "slots.Products.productId": productId
          //   },
          //   {
          //     $set: {
          //       "slots.$[slot].Products.$[product].qty": newQty
          //     }
          //   },
          //   {
          //     arrayFilters: [
          //       { "slot._id": slotId },
          //       { "product.productId": productId }
          //     ],
          //     session
          //   }
          // );

        }
      }

      // 4. Commit transaction
      await session.commitTransaction();
      session.endSession();

      return res.json({
        success: true,
        message: "Quotation and inventory updated successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error creating quotation:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update quotation",
      });
    }
  }

  // async allquotations(req, res) {
  //   try {
  //     const quoteData = await Quotationmodel.find({}).sort({ _id: -1 });

  //     console.log("quoteData--",quoteData);
  //     console.log("slots--",quoteData[0]?.slots[0]?.Products)

  //     if (quoteData) {
  //       return res.status(200).json({ quoteData: quoteData });
  //     }
  //   } catch (error) {
  //     console.error("Something went wrong", error);
  //     return res.status(500).json({ error: "Internal server error" });
  //   }
  // }

  async postdeletequotation(req, res) {
    const { id } = req.params;
    try {
      const data = await Quotationmodel.deleteOne({ _id: id });
      if (data.deletedCount > 0) {
        return res.json({ success: "Successfully deleted" });
      } else {
        return res.status(404).json({ error: "quotation not found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete quotation" });
    }
  }

  async updateQuotation(req, res) {
    const {
      quoteId,
      labourecharge,
      transportcharge,
      adjustments,
      GrandTotal,
      status,
      GST, discount
    } = req.body;
    console.log(
      quoteId,
      labourecharge,
      transportcharge,
      adjustments,
      GrandTotal,
      GST, discount,
      "efirwiu"
    );
    try {
      // Find the quotation by quoteId
      const quotation = await Quotationmodel.findOne({ quoteId });

      if (!quotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      // Update the charges if provided
      if (labourecharge !== undefined) {
        quotation.labourecharge = labourecharge;
      }
      if (transportcharge !== undefined) {
        quotation.transportcharge = transportcharge;
      }
      if (adjustments !== undefined) {
        quotation.adjustments = adjustments;
      }
      if (GrandTotal !== undefined) {
        quotation.GrandTotal = GrandTotal;
      }
      if (GST !== undefined) {
        quotation.GST = GST;
      }
      if (discount !== undefined) {
        quotation.discount = discount;
      }


      if (status !== undefined) {
        if (["pending", "send"].includes(status)) {
          quotation.status = status; // Update status if valid
        } else {
          return res.status(400).json({ error: "Invalid status value" });
        }
      }

      // Save the updated quotation
      const updatedQuotation = await quotation.save();

      return res.status(200).json({
        success: "Quotation updated successfully",
        data: updatedQuotation,
      });
    } catch (error) {
      console.error("Error updating quotation:", error.message);
      return res.status(500).json({ error: "Failed to update quotation" });
    }
  }

  // addproductquotations
  // async addProductsToSlots(req, res) {
  //   const { id, slots,GrandTotal } = req.body;
  //   console.log(id,slots,"slots")
  //   try {
  //     // Find the quotation by quoteId
  //     const quotation = await Quotationmodel.findOne({ quoteId: id });

  //     if (!quotation) {
  //       return res.status(404).json({ error: "Quotation not found" });
  //     }

  //     // Validate slots array
  //     if (!Array.isArray(slots) || slots.length === 0) {
  //       return res.status(400).json({ error: "Slots must be a non-empty array" });
  //     }

  //     // Update or add slots
  //     slots.forEach((newSlot) => {
  //       const existingSlotIndex = quotation.slots.findIndex(
  //         (slot) => slot.slotName === newSlot.slotName
  //       );

  //       if (existingSlotIndex !== -1) {
  //         // If the slot exists, merge its products with the new products
  //         quotation.slots[existingSlotIndex].Products.push(...newSlot.Products);
  //       } else {
  //         // If the slot does not exist, add it as a new slot
  //         quotation.slots.push(newSlot);
  //       }
  //     });

  //     // Save the updated quotation
  //     const updatedQuotation = await quotation.save();

  //     return res.status(200).json({
  //       success: "Products added to slots successfully",
  //       data: updatedQuotation,
  //     });
  //   } catch (error) {
  //     console.error("Error adding products to slots:", error.message);
  //     return res.status(500).json({ error: "Failed to add products to slots" });
  //   }
  // }

  // this code working fine whiout inventory
  // async addProductsToSlots(req, res) {
  //   const { id, slots, GrandTotal } = req.body;
  //   // console.log(id, slots,GrandTotal, "slots");

  //   try {
  //     // Find the quotation by quoteId
  //     const quotation = await Quotationmodel.findOne({ quoteId: id });

  //     if (!quotation) {
  //       return res.status(404).json({ error: "Quotation not found" });
  //     }

  //     // Validate slots array
  //     if (!Array.isArray(slots) || slots.length === 0) {
  //       return res.status(400).json({ error: "Slots must be a non-empty array" });
  //     }

  //     // Update or add slots
  //     slots.forEach((newSlot) => {
  //       const existingSlotIndex = quotation.slots.findIndex(
  //         (slot) => slot.slotName === newSlot.slotName
  //       );

  //       if (existingSlotIndex !== -1) {
  //         // If the slot exists, merge its products with the new products
  //         quotation.slots[existingSlotIndex].Products.push(...newSlot.Products);
  //       } else {
  //         // If the slot does not exist, add it as a new slot
  //         quotation.slots.push(newSlot);
  //       }
  //     });

  //     // Update the GrandTotal in the database
  //     if (GrandTotal !== undefined) {
  //       quotation.GrandTotal = GrandTotal;
  //     }

  //     // Save the updated quotation
  //     const updatedQuotation = await quotation.save();

  //     return res.status(200).json({
  //       success: "Products added to slots successfully and GrandTotal updated",
  //       data: updatedQuotation,
  //     });
  //   } catch (error) {
  //     console.error("Error adding products to slots:", error.message);
  //     return res.status(500).json({ error: "Failed to add products to slots" });
  //   }
  // }

  // this code is inventory management system +++++
  async addProductsToSlots(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id, slots, GrandTotal } = req.body;

      // Find the quotation by quoteId
      const quotation = await Quotationmodel.findOne({ quoteId: id }).session(
        session
      );

      if (!quotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      // Validate slots array
      if (!Array.isArray(slots) || slots.length === 0) {
        return res
          .status(400)
          .json({ error: "Slots must be a non-empty array" });
      }

      for (const newSlot of slots) {
        const existingSlotIndex = quotation.slots.findIndex(
          (slot) => slot.slotName === newSlot.slotName
        );

        if (existingSlotIndex !== -1) {
          // Merge products into the existing slot
          for (const newProduct of newSlot.Products) {
            const { productId, quantity, StockAvailable } = newProduct;

            // Check inventory for availability
            const overlappingReservations = await InventoryModel.find({
              productId,
              $or: [
                {
                  startdate: { $lte: quotation.endDate },
                  enddate: { $gte: quotation.quoteDate },
                },
              ],
              slot: newSlot.slotName,
            }).session(session);

            // Build per-day reservation map (peak-day logic, not sum across overlaps)
            const dailyReservedMap = {};
            for (const entry of overlappingReservations) {
              const entryStart = parseDate(entry.startdate);
              const entryEnd = parseDate(entry.enddate);
              if (!entryStart || !entryEnd) continue;
              for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split("T")[0];
                dailyReservedMap[key] =
                  (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
              }
            }
            const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

            const availableStock = Math.max(StockAvailable - maxReserved, 0);

            if (availableStock < quantity) {
              throw new Error(
                `Insufficient stock for product: ${newProduct.productName} in slot: ${newSlot.slotName}. Only ${availableStock} available due to overlapping reservations.`
              );
            }

            const existingProductIndex = quotation.slots[
              existingSlotIndex
            ].Products.findIndex(
              (product) => product.productId === newProduct.productId
            );

            if (existingProductIndex !== -1) {
              // If the product exists, optionally update its quantity
              console.log(
                `Product ${newProduct.productId} already exists in slot ${newSlot.slotName}, skipping.`
              );
            } else {
              // Add the product as a new entry
              quotation.slots[existingSlotIndex].Products.push({
                ...newProduct,
                StockAvailable: availableStock - quantity,
              });
            }

            // Update or create inventory for the current slot
            const existingInventory = await InventoryModel.findOne({
              productId,
              startdate: quotation.quoteDate,
              enddate: quotation.endDate,
              slot: newSlot.slotName,
            }).session(session);

            if (existingInventory) {
              existingInventory.reservedQty += quantity;
              existingInventory.availableQty = availableStock - quantity;
              await existingInventory.save({ session });
            } else {
              const newInventory = new InventoryModel({
                productId,
                startdate: quotation.quoteDate,
                enddate: quotation.endDate,
                slot: newSlot.slotName,
                reservedQty: quantity,
                availableQty: availableStock - quantity,
              });

              await newInventory.save({ session });
            }
          }
        } else {
          // If the slot does not exist, add it as a new slot
          quotation.slots.push(newSlot);

          for (const newProduct of newSlot.Products) {
            const { productId, quantity, StockAvailable } = newProduct;

            // Check inventory for availability
            const overlappingReservations = await InventoryModel.find({
              productId,
              $or: [
                {
                  startdate: { $lte: quotation.endDate },
                  enddate: { $gte: quotation.quoteDate },
                },
              ],
              slot: newSlot.slotName,
            }).session(session);

            // Build per-day reservation map (peak-day logic, not sum across overlaps)
            const dailyReservedMap = {};
            for (const entry of overlappingReservations) {
              const entryStart = parseDate(entry.startdate);
              const entryEnd = parseDate(entry.enddate);
              if (!entryStart || !entryEnd) continue;
              for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split("T")[0];
                dailyReservedMap[key] =
                  (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
              }
            }
            const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

            const availableStock = Math.max(StockAvailable - maxReserved, 0);

            if (availableStock < quantity) {
              throw new Error(
                `Insufficient stock for product: ${newProduct.productName} in slot: ${newSlot.slotName}. Only ${availableStock} available due to overlapping reservations.`
              );
            }

            // Update or create inventory for the new slot
            const newInventory = new InventoryModel({
              productId,
              startdate: quotation.quoteDate,
              enddate: quotation.endDate,
              slot: newSlot.slotName,
              reservedQty: quantity,
              availableQty: availableStock - quantity,
            });

            await newInventory.save({ session });
          }
        }
      }

      // Update the GrandTotal
      if (GrandTotal !== undefined) {
        quotation.GrandTotal = GrandTotal;
      }

      // Save the updated quotation
      const updatedQuotation = await quotation.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: "Products added to slots successfully and inventory updated",
        data: updatedQuotation,
      });
    } catch (error) {
      // Abort the transaction in case of an error
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding products to slots:", error.message);
      return res
        .status(500)
        .json({ error: error.message || "Failed to add products to slots" });
    }
  }

  // chaubay

  // async addOntherProductsToSlots(req, res) {
  //   const { id, slots,GrandTotal } = req.body;
  //   console.log(id,slots,"slots")
  //   try {
  //     // Find the quotation by quoteId
  //     const quotation = await Quotationmodel.findOne({ quoteId: id });

  //     if (!quotation) {
  //       return res.status(404).json({ error: "Quotation not found" });
  //     }

  //     // Validate slots array
  //     if (!Array.isArray(slots) || slots.length === 0) {
  //       return res.status(400).json({ error: "Slots must be a non-empty array" });
  //     }

  //     slots.forEach((newSlot) => {
  //       const existingSlotIndex = quotation.slots.findIndex(
  //         (slot) => slot.slotName === newSlot.slotName
  //       );

  //       if (existingSlotIndex === -1) {
  //         return res
  //           .status(400)
  //           .json({ error: `Slot ${newSlot.slotName} does not exist.` });
  //       }

  //       const existingProducts = Array.isArray(
  //         quotation.slots[existingSlotIndex].Products
  //       )
  //         ? quotation.slots[existingSlotIndex].Products
  //         : [];

  //       const newProducts = Array.isArray(newSlot.Products) ? newSlot.Products : [];

  //       newProducts.forEach((newProduct) => {
  //         const existingProductIndex = existingProducts.findIndex(
  //           (product) => product.productId === newProduct.productId
  //         );

  //         const productQuantity = Number(newProduct.quantity);
  //         const productPrice = Number(newProduct.price);
  //         const stockAvailable = Number(newProduct.StockAvailable);

  //         if (
  //           isNaN(productQuantity) ||
  //           isNaN(productPrice) ||
  //           isNaN(stockAvailable)
  //         ) {
  //           console.error(
  //             `Invalid product data: ${JSON.stringify(newProduct)}`
  //           );
  //           return; // Skip invalid product
  //         }

  //         if (existingProductIndex !== -1) {
  //           const existingProduct = existingProducts[existingProductIndex];

  //           if (productQuantity <= stockAvailable) {
  //             // Update existing product
  //             existingProduct.quantity += productQuantity;
  //             existingProduct.total += productQuantity * productPrice;
  //             existingProduct.StockAvailable -= productQuantity;
  //           } else {
  //             // Use up all available stock and add remaining as a new product
  //             const remainingStock = productQuantity - stockAvailable;

  //             existingProduct.quantity += stockAvailable;
  //             existingProduct.total += stockAvailable * productPrice;
  //             existingProduct.StockAvailable = 0;

  //             // Add remaining as a new product if stock is exceeded
  //             existingProducts.push({
  //               productId: newProduct.productId,
  //               productName: newProduct.productName || "Unnamed Product",
  //               quantity: remainingStock,
  //               price: productPrice,
  //               total: remainingStock * productPrice,
  //               StockAvailable: 0, // No stock left for this product
  //             });
  //           }
  //         } else {
  //           // Add new product
  //           const quantityToAdd =
  //             productQuantity <= stockAvailable ? productQuantity : stockAvailable;

  //           existingProducts.push({
  //             productId: newProduct.productId,
  //             productName: newProduct.productName || "Unnamed Product",
  //             quantity: quantityToAdd,
  //             price: productPrice,
  //             total: quantityToAdd * productPrice,
  //             StockAvailable: stockAvailable - quantityToAdd,
  //           });

  //           // If there's an excess order, add remaining as a new product
  //           if (productQuantity > stockAvailable) {
  //             const remainingQuantity = productQuantity - stockAvailable;

  //             existingProducts.push({
  //               productId: newProduct.productId,
  //               productName: newProduct.productName || "Unnamed Product",
  //               quantity: remainingQuantity,
  //               price: productPrice,
  //               total: remainingQuantity * productPrice,
  //               StockAvailable: 0, // No stock left for this product
  //             });
  //           }
  //         }
  //       });

  //       // Update the slot with updated products
  //       quotation.slots[existingSlotIndex].Products = existingProducts.filter(
  //         (product) => product.quantity > 0
  //       );
  //     });

  //     // Recalculate the GrandTotal
  //     const updatedGrandTotal = quotation.slots.reduce((total, slot) => {
  //       const slotTotal = slot.Products.reduce((sum, product) => {
  //         const productTotal = Number(product.total) || 0;
  //         return sum + productTotal;
  //       }, 0);
  //       return total + slotTotal;
  //     }, 0);

  //     if (isNaN(updatedGrandTotal)) {
  //       throw new Error("Invalid GrandTotal calculation");
  //     }

  //     quotation.GrandTotal = updatedGrandTotal;

  //     // Save the updated quotation
  //     const updatedQuotation = await quotation.save();

  //     return res.status(200).json({
  //       success: "Products added to slots successfully and GrandTotal updated",
  //       data: updatedQuotation,
  //     });
  //   } catch (error) {
  //     console.error("Error adding products to slots:", error.message);
  //     return res.status(500).json({ error: "Failed to add products to slots" });
  //   }
  // }

  // async addOntherProductsToSlots(req, res) {
  //   const { id, slots, productId } = req.body;

  //   console.log("Request Data:", { id, slots, productId });

  //   try {
  //     // Find the quotation by quoteId
  //     const quotation = await Quotationmodel.findOne({ quoteId: id });

  //     if (!quotation) {
  //       return res.status(404).json({ error: "Quotation not found" });
  //     }

  //     // Validate slots array
  //     if (!Array.isArray(slots) || slots.length === 0) {
  //       return res.status(400).json({ error: "Slots must be a non-empty array" });
  //     }

  //     slots.forEach((newSlot) => {
  //       const existingSlotIndex = quotation.slots.findIndex(
  //         (slot) => slot.slotName === newSlot.slotName
  //       );

  //       if (existingSlotIndex === -1) {
  //         throw new Error(`Slot ${newSlot.slotName} does not exist.`);
  //       }

  //       const existingProducts = Array.isArray(
  //         quotation.slots[existingSlotIndex].Products
  //       )
  //         ? quotation.slots[existingSlotIndex].Products
  //         : [];

  //       const newProducts = Array.isArray(newSlot.Products) ? newSlot.Products : [];

  //       newProducts.forEach((newProduct) => {
  //         const productQuantity = Number(newProduct.quantity);
  //         const productPrice = Number(newProduct.price);
  //         const stockAvailable = Number(newProduct.StockAvailable || 0);

  //         if (
  //           isNaN(productQuantity) ||
  //           isNaN(productPrice) ||
  //           isNaN(stockAvailable)
  //         ) {
  //           console.error(
  //             `Invalid product data: ${JSON.stringify(newProduct)}`
  //           );
  //           return; // Skip invalid product
  //         }

  //         const existingProductIndex = existingProducts.findIndex(
  //           (product) => product.productId === newProduct.productId
  //         );

  //         if (existingProductIndex !== -1) {
  //           // Update the existing product
  //           const existingProduct = existingProducts[existingProductIndex];

  //           if (productQuantity <= existingProduct.quantity) {
  //             // Deduct the alternate product quantity from the main product
  //             existingProduct.quantity -= productQuantity;
  //             existingProduct.total -= productQuantity * existingProduct.price;
  //             existingProduct.StockAvailable += productQuantity;

  //             // Check if the alternate product already exists in the array
  //             const alternateProductIndex = existingProducts.findIndex(
  //               (product) =>
  //                 product.productId === newProduct.productId &&
  //                 product.productName === newProduct.productName
  //             );

  //             if (alternateProductIndex !== -1) {
  //               // Update the existing alternate product
  //               existingProducts[alternateProductIndex].quantity += productQuantity;
  //               existingProducts[alternateProductIndex].total +=
  //                 productQuantity * productPrice;
  //             } else {
  //               // Add the alternate product as a new entry
  //               existingProducts.push({
  //                 productId: newProduct.productId,
  //                 productName: newProduct.productName || "Alternate Product",
  //                 quantity: productQuantity,
  //                 price: productPrice,
  //                 total: productQuantity * productPrice,
  //                 StockAvailable: stockAvailable - productQuantity,
  //               });
  //             }
  //           } else {
  //             throw new Error(
  //               `Insufficient quantity for product ${existingProduct.productName}`
  //             );
  //           }
  //         } else {
  //           // Add new product
  //           existingProducts.push({
  //             productId: newProduct.productId,
  //             productName: newProduct.productName || "Alternate Product",
  //             quantity: productQuantity,
  //             price: productPrice,
  //             total: productQuantity * productPrice,
  //             StockAvailable: stockAvailable - productQuantity,
  //           });
  //         }
  //       });

  //       // Update the slot with updated products
  //       quotation.slots[existingSlotIndex].Products = existingProducts.filter(
  //         (product) => product.quantity > 0
  //       );
  //     });

  //     // Recalculate the GrandTotal
  //     const updatedGrandTotal = quotation.slots.reduce((total, slot) => {
  //       const slotTotal = slot.Products.reduce((sum, product) => {
  //         const productTotal = Number(product.total) || 0;
  //         return sum + productTotal;
  //       }, 0);
  //       return total + slotTotal;
  //     }, 0);

  //     if (isNaN(updatedGrandTotal)) {
  //       throw new Error("Invalid GrandTotal calculation");
  //     }

  //     quotation.GrandTotal = updatedGrandTotal;

  //     // Save the updated quotation
  //     const updatedQuotation = await quotation.save();

  //     return res.status(200).json({
  //       success: "Products and alternate products updated successfully",
  //       data: updatedQuotation,
  //     });
  //   } catch (error) {
  //     console.error("Error adding alternate products to slots:", error.message);
  //     return res.status(500).json({ error: error.message || "Failed to add products to slots" });
  //   }
  // }

  async addOntherProductsToSlots(req, res) {
    const { id, slots, productId } = req.body;

    console.log("Request Data:", { id, slots, productId });

    try {
      // Find the quotation by quoteId
      const quotation = await Quotationmodel.findOne({ quoteId: id });

      if (!quotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      // Validate slots array
      if (!Array.isArray(slots) || slots.length === 0) {
        return res
          .status(400)
          .json({ error: "Slots must be a non-empty array" });
      }

      slots.forEach((newSlot) => {
        const existingSlotIndex = quotation.slots.findIndex(
          (slot) => slot.slotName === newSlot.slotName
        );

        if (existingSlotIndex === -1) {
          throw new Error(`Slot ${newSlot.slotName} does not exist.`);
        }

        const existingProducts = Array.isArray(
          quotation.slots[existingSlotIndex].Products
        )
          ? quotation.slots[existingSlotIndex].Products
          : [];

        const newProducts = Array.isArray(newSlot.Products)
          ? newSlot.Products
          : [];

        newProducts.forEach((newProduct) => {
          const productQuantity = Number(newProduct.quantity);
          const productPrice = Number(newProduct.price);
          const stockAvailable = Number(newProduct.StockAvailable || 0);

          if (
            isNaN(productQuantity) ||
            isNaN(productPrice) ||
            isNaN(stockAvailable)
          ) {
            console.error(
              `Invalid product data: ${JSON.stringify(newProduct)}`
            );
            return; // Skip invalid product
          }

          const existingProductIndex = existingProducts.findIndex(
            (product) => product.productId === newProduct.productId
          );

          if (existingProductIndex !== -1) {
            const existingProduct = existingProducts[existingProductIndex];

            if (productQuantity <= existingProduct.quantity) {
              // Deduct the alternate product quantity from the main product
              existingProduct.quantity -= productQuantity;
              existingProduct.total -= productQuantity * existingProduct.price;

              // Update the `StockAvailable` for the alternate product
              newProduct.StockAvailable =
                existingProduct.StockAvailable - productQuantity;

              // Add or update the alternate product
              const alternateProductIndex = existingProducts.findIndex(
                (product) =>
                  product.productId === newProduct.productId &&
                  product.productName === newProduct.productName
              );

              if (alternateProductIndex !== -1) {
                // Update the existing alternate product
                existingProducts[alternateProductIndex].quantity +=
                  productQuantity;
                existingProducts[alternateProductIndex].total +=
                  productQuantity * productPrice;
              } else {
                // Add the alternate product as a new entry
                existingProducts.push({
                  productId: newProduct.productId,
                  productName: newProduct.productName || "Alternate Product",
                  quantity: productQuantity,
                  price: productPrice,
                  total: productQuantity * productPrice,
                  StockAvailable: Math.max(stockAvailable - productQuantity, 0),
                });
              }
            } else {
              throw new Error(
                `Insufficient quantity for product ${existingProduct.productName}`
              );
            }
          } else {
            // Add the alternate product if it doesn't already exist
            existingProducts.push({
              productId: newProduct.productId,
              productName: newProduct.productName || "Alternate Product",
              quantity: productQuantity,
              price: productPrice,
              total: productQuantity * productPrice,
              StockAvailable: Math.max(stockAvailable - productQuantity, 0),
            });
          }
        });

        // Update the slot with updated products
        quotation.slots[existingSlotIndex].Products = existingProducts.filter(
          (product) => product.quantity > 0
        );
      });

      // Recalculate the GrandTotal
      const updatedGrandTotal = quotation.slots.reduce((total, slot) => {
        const slotTotal = slot.Products.reduce((sum, product) => {
          const productTotal = Number(product.total) || 0;
          return sum + productTotal;
        }, 0);
        return total + slotTotal;
      }, 0);

      if (isNaN(updatedGrandTotal)) {
        throw new Error("Invalid GrandTotal calculation");
      }

      quotation.GrandTotal = updatedGrandTotal;

      // Save the updated quotation
      const updatedQuotation = await quotation.save();

      return res.status(200).json({
        success: "Products and alternate products updated successfully",
        data: updatedQuotation,
      });
    } catch (error) {
      console.error("Error adding alternate products to slots:", error.message);
      return res
        .status(500)
        .json({ error: error.message || "Failed to add products to slots" });
    }
  }

  // update quotation
  async updateQuotation1(req, res) {
    const { quoteId, labourecharge, transportcharge, GrandTotal, adjustments, GST, discount } =
      req.body;
    console.log(labourecharge, transportcharge, GrandTotal, adjustments, GST, discount);

    try {
      // Fetch the quotation by ID
      const quotation = await Quotationmodel.findOne({ quoteId });

      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      // Update labor and transport charges
      if (labourecharge !== undefined) {
        quotation.labourecharge = labourecharge;
      }

      if (transportcharge !== undefined) {
        quotation.transportcharge = transportcharge;
      }
      if (GrandTotal !== undefined) {
        quotation.GrandTotal = GrandTotal;
      }
      if (adjustments !== undefined) {
        quotation.adjustments = adjustments;
      }
      if (GST !== undefined) {
        quotation.GST = GST;
      }
      if (discount !== undefined) {
        quotation.discount = discount;
      }
      // Save the updated quotation
      const updatedQuotation = await quotation.save();

      // Send updated grand total and response back to the frontend
      res.status(200).json({
        message: "Quotation updated successfully",
        GrandTotal: quotation.GrandTotal,
        updatedQuotation,
      });
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(500).json({ message: "Error updating quotation", error });
    }
  }

  // 17-01-22024

  async addOntherProductsToSlotstwo(req, res) {
    const { id, slots } = req.body;

    console.log("Request Data:", { id, slots });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the quotation by quoteId
      const quotation = await Quotationmodel.findOne({ quoteId: id }).session(
        session
      );

      if (!quotation) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Quotation not found" });
      }

      // Validate slots array
      if (!Array.isArray(slots) || slots.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: "Slots must be a non-empty array" });
      }

      slots.forEach((newSlot) => {
        const existingSlotIndex = quotation.slots.findIndex(
          (slot) => slot.slotName === newSlot.slotName
        );

        if (existingSlotIndex === -1) {
          throw new Error(`Slot ${newSlot.slotName} does not exist.`);
        }

        const existingProducts = Array.isArray(
          quotation.slots[existingSlotIndex].Products
        )
          ? quotation.slots[existingSlotIndex].Products
          : [];

        const newProducts = Array.isArray(newSlot.Products)
          ? newSlot.Products
          : [];

        newProducts.forEach((newProduct) => {
          const productQuantity = Number(newProduct.quantity);
          const productPrice = Number(newProduct.price);
          const stockAvailable = Number(newProduct.StockAvailable || 0);

          // Log for debugging
          console.log("Processing Product:", {
            productId: newProduct.productId,
            stockAvailable,
            productQuantity,
          });

          if (
            isNaN(productQuantity) ||
            isNaN(productPrice) ||
            isNaN(stockAvailable)
          ) {
            console.error(
              `Invalid product data: ${JSON.stringify(newProduct)}`
            );
            return; // Skip invalid product
          }

          const existingProductIndex = existingProducts.findIndex(
            (product) => product.productId === newProduct.productId
          );

          if (existingProductIndex === -1) {
            // Add the product as a new entry
            existingProducts.push({
              productId: newProduct.productId,
              productName: newProduct.productName || "New Product",
              quantity: productQuantity,
              price: productPrice,
              total: productQuantity * productPrice,
              StockAvailable: stockAvailable
              // stockAvailable >= productQuantity
              // ? stockAvailable - productQuantity
              // : stockAvailable, // Only subtract if stock is sufficient
            });
          } else {
            // If product exists, optionally update stock or quantity
            console.log(
              `Product ${newProduct.productId} already exists in slot ${newSlot.slotName}, skipping.`
            );
          }
        });

        // Update the slot with updated products
        quotation.slots[existingSlotIndex].Products = existingProducts;
      });

      // Recalculate the GrandTotal
      const updatedGrandTotal = quotation.slots.reduce((total, slot) => {
        const slotTotal = slot.Products.reduce((sum, product) => {
          const productTotal = Number(product.total) || 0;
          return sum + productTotal;
        }, 0);
        return total + slotTotal;
      }, 0);

      if (isNaN(updatedGrandTotal)) {
        throw new Error("Invalid GrandTotal calculation");
      }

      quotation.GrandTotal = updatedGrandTotal;

      // Save the updated quotation
      const updatedQuotation = await quotation.save({ session });

      for (const slot of slots) {
        const { Products, slotName } = slot;
        console.log("Products1111--", Products);
        const lastProduct = Products[Products.length - 1];

        console.log("lastProduct", lastProduct);
        const dataa = [lastProduct];

        for (const product of dataa) {
          const { productId, quantity, StockAvailable } = product;

          // Fetch overlapping reservations for the requested date range and slot
          const overlappingReservations = await InventoryModel.find({
            productId,
            $or: [
              {
                startdate: { $lte: quotation.endDate },
                enddate: { $gte: quotation.quoteDate },
              },
            ],
            slot: slotName,
          }).session(session);

          // Build per-day reservation map (peak-day logic, not sum across overlaps)
          const dailyReservedMap = {};
          for (const entry of overlappingReservations) {
            const entryStart = parseDate(entry.startdate);
            const entryEnd = parseDate(entry.enddate);
            if (!entryStart || !entryEnd) continue;
            for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().split("T")[0];
              dailyReservedMap[key] =
                (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
            }
          }
          const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

          console.log("product--", product);
          const availableStock = Math.max(StockAvailable - maxReserved, 0);

          if (availableStock < quantity) {
            throw new Error(
              `Insufficient stock for product: ${product.productName} in slot: ${slotName}. Only ${availableStock} available for the requested date range: ${quotation.quoteDate} to ${quotation.endDate}, due to overlapping reservations.`
            );
          }

          // Update or create inventory for the current slot
          const existingInventory = await InventoryModel.findOne({
            productId,
            startdate: quotation.quoteDate,
            enddate: quotation.endDate,
            slot: slotName,
          }).session(session);

          if (existingInventory) {
            existingInventory.reservedQty += quantity;
            existingInventory.availableQty = availableStock - quantity;
            await existingInventory.save({ session });
          } else {
            const newInventory = new InventoryModel({
              productId,
              startdate: quotation.quoteDate,
              enddate: quotation.endDate,
              slot: slotName,
              reservedQty: quantity,
              availableQty: availableStock - quantity,
            });

            await newInventory.save({ session });
          }
        }
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: "Products added successfully to slots",
        data: updatedQuotation,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding products to slots:", error.message);
      return res
        .status(500)
        .json({ error: error.message || "Failed to add products to slots" });
    }
  }

  // 26-03-2025
  async addOntherProductsToSlotsQuotation(req, res) {
    const { id, slots } = req.body;

    console.log("Request Data:", { id, slots });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const quotation = await Quotationmodel.findOne({ quoteId: id }).session(session);

      if (!quotation) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Quotation not found" });
      }

      if (!Array.isArray(slots) || slots.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Slots must be a non-empty array" });
      }

      slots.forEach((newSlot) => {
        const existingSlotIndex = quotation.slots.findIndex(
          (slot) => slot.slotName === newSlot.slotName
        );

        if (existingSlotIndex === -1) {
          throw new Error(`Slot ${newSlot.slotName} does not exist.`);
        }

        const existingProducts = Array.isArray(
          quotation.slots[existingSlotIndex].Products
        )
          ? quotation.slots[existingSlotIndex].Products
          : [];

        const newProducts = Array.isArray(newSlot.Products)
          ? newSlot.Products
          : [];

        newProducts.forEach((newProduct) => {
          const productQuantity = Number(newProduct.quantity);
          const productPrice = Number(newProduct.price);
          const stockAvailable = Number(newProduct.StockAvailable || 0);

          console.log("Processing Product:", {
            productId: newProduct.productId,
            stockAvailable,
            productQuantity,
          });

          if (
            isNaN(productQuantity) ||
            isNaN(productPrice) ||
            isNaN(stockAvailable)
          ) {
            console.error(`Invalid product data: ${JSON.stringify(newProduct)}`);
            return;
          }

          const existingProductIndex = existingProducts.findIndex(
            (product) => product.productId === newProduct.productId
          );

          if (existingProductIndex === -1) {
            existingProducts.push({
              productId: newProduct.productId,
              productName: newProduct.productName || "New Product",
              quantity: productQuantity,
              price: productPrice,
              total: productQuantity * productPrice,
              StockAvailable: stockAvailable,
            });
          } else {
            console.log(`Product ${newProduct.productId} already exists in slot ${newSlot.slotName}, skipping.`);
          }
        });

        quotation.slots[existingSlotIndex].Products = existingProducts;
      });

      // Final GrandTotal Calculation as per new formula
      const productTotal = quotation.slots.reduce((total, slot) => {
        return total + slot.Products.reduce((sum, product) => sum + (Number(product.price) * Number(product.quantity) || 0), 0);
      }, 0);

      const discountPercentage = Number(quotation.discount) || 0;
      const discountAmount = (productTotal * discountPercentage) / 100;
      const productTotalAfterDiscount = productTotal - discountAmount;

      const labourCharge = Number(quotation.labourecharge) || 0;
      const transportCharge = Number(quotation.transportcharge) || 0;
      const subTotal = productTotalAfterDiscount + labourCharge + transportCharge;

      const gstRate = Number(quotation.GST) || 0;
      const gstAmount = subTotal * gstRate;

      const adjustment = Number(quotation.adjustments) || 0;
      const finalGrandTotal = subTotal + gstAmount - adjustment;

      quotation.GrandTotal = Number(finalGrandTotal.toFixed(2));

      const updatedQuotation = await quotation.save({ session });

      for (const slot of slots) {
        const { Products, slotName } = slot;
        const lastProduct = Products[Products.length - 1];
        const dataa = [lastProduct];

        for (const product of dataa) {
          const { productId, quantity, StockAvailable } = product;

          const overlappingReservations = await InventoryModel.find({
            productId,
            $or: [
              {
                startdate: { $lte: quotation.endDate },
                enddate: { $gte: quotation.quoteDate },
              },
            ],
            slot: slotName,
          }).session(session);

          // Build per-day reservation map (peak-day logic, not sum across overlaps)
          const dailyReservedMap = {};
          for (const entry of overlappingReservations) {
            const entryStart = parseDate(entry.startdate);
            const entryEnd = parseDate(entry.enddate);
            if (!entryStart || !entryEnd) continue;
            for (let d = new Date(entryStart); d <= entryEnd; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().split("T")[0];
              dailyReservedMap[key] =
                (dailyReservedMap[key] || 0) + (entry.reservedQty || 0);
            }
          }
          const maxReserved = Math.max(0, ...Object.values(dailyReservedMap));

          const availableStock = Math.max(StockAvailable - maxReserved, 0);

          if (availableStock < quantity) {
            throw new Error(`Insufficient stock for product: ${product.productName} in slot: ${slotName}. Only ${availableStock} available.`);
          }

          const existingInventory = await InventoryModel.findOne({
            productId,
            startdate: quotation.quoteDate,
            enddate: quotation.endDate,
            slot: slotName,
          }).session(session);

          if (existingInventory) {
            existingInventory.reservedQty += quantity;
            existingInventory.availableQty = availableStock - quantity;
            await existingInventory.save({ session });
          } else {
            const newInventory = new InventoryModel({
              productId,
              startdate: quotation.quoteDate,
              enddate: quotation.endDate,
              slot: slotName,
              reservedQty: quantity,
              availableQty: availableStock - quantity,
            });

            await newInventory.save({ session });
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: "Products added successfully to slots",
        data: updatedQuotation,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding products to slots:", error.message);
      return res.status(500).json({ error: error.message || "Failed to add products to slots" });
    }
  }

  // 19 May 25
  async cancelQuotation(req, res) {
    console.log(`inside  cancelQuotation`);
    const { id } = req.params;
    console.log(`quotaion id: `, id);

    try {
      // Get the quotation
      const quotation = await Quotationmodel.findById(id);
      console.log(`Found quotation: `, quotation);
      if (!quotation) {
        throw new Error("Quotation not found");
      }

      // Update quotation status
      quotation.status = "cancelled";
      await quotation.save();

      res.status(200).json({ message: "Quotation cancelled successfully" });
    } catch (error) {
      console.log(`error in cancelQuotation `);
      // Abort transaction on error
      console.error("Error cancelling quotation:", error);
      res.status(500).json({ error: error.message || "Failed to cancel quotation" });
    }
  }
  // new code
  // async createQuotations(req, res) {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //       const {
  //           clientId,
  //           quoteDate,
  //           endDate,
  //           quoteTime,
  //           clientName,
  //           clientNo,
  //           address,
  //           Products,
  //           category,
  //           status,
  //           GrandTotal,
  //           adjustments,
  //           discount,
  //           termsandCondition,
  //           GST,
  //           executivename,
  //           placeaddress,
  //           slots,
  //       } = req.body;

  //       console.log("🔄 Processing Quotation for slot:", quoteTime);

  //       // ✅ Convert date format to avoid RangeError
  //       const formattedQuoteDate = moment(quoteDate, "DD-MM-YYYY").format("DD-MM-YYYY");
  //       const formattedEndDate = moment(endDate, "DD-MM-YYYY").format("DD-MM-YYYY");

  //       // Generate unique quotation ID
  //       const latestQuotation = await Quotationmodel.findOne()
  //           .sort({ _id: -1 })
  //           .session(session);

  //       const nextQuoteId = latestQuotation
  //           ? `QT${(parseInt(latestQuotation.quoteId.replace("QT", ""), 10) + 1)
  //               .toString()
  //               .padStart(4, "0")}`
  //           : "QT0001";

  //       // 🔥 STEP 1: STRICT INVENTORY CHECK (NO NEGATIVE VALUES ALLOWED)
  //       for (const slot of slots) {
  //           const { Products, slotName } = slot; // Slot name from Enquiry

  //           for (const product of Products) {
  //               const { productId, quantity } = product;

  //               // ✅ Fetch product details
  //               const productData = await ProductModel.findById(productId).session(session).lean();
  //               if (!productData) throw new Error(`Product ${productId} not found.`);

  //               // ✅ Find all past reservations for this product and slot
  //               const existingReservations = await InventoryModel.find({
  //                   productId: productId,
  //                   slot: slotName,
  //                   startdate: { $lte: formattedEndDate },
  //                   enddate: { $gte: formattedQuoteDate },
  //               }).session(session);

  //               // ✅ Calculate total reserved quantity for overlapping bookings
  //               let totalReservedQty = existingReservations.reduce(
  //                   (sum, booking) => sum + booking.reservedQty,
  //                   0
  //               );

  //               // ✅ Compute the correct available stock
  //               let availableStock = productData.StockAvailable - totalReservedQty;

  //               // 🚨 **STRICT OVERBOOKING PREVENTION**
  //               if (availableStock < quantity) {
  //                   await session.abortTransaction();
  //                   session.endSession();
  //                   return res.status(400).json({
  //                       error: `❌ Booking Conflict: 
  //                       Product "${productData.ProductName}" is overbooked in Slot "${slotName}".
  //                       Available: ${availableStock}, Requested: ${quantity}, Reserved: ${totalReservedQty}.
  //                       🚫 No more bookings allowed for this slot.`
  //                   });
  //               }

  //               // ✅ Update or create inventory record
  //               let existingInventory = await InventoryModel.findOne({
  //                   productId,
  //                   startdate: formattedQuoteDate,
  //                   enddate: formattedEndDate,
  //                   slot: slotName
  //               }).session(session);

  //               if (existingInventory) {
  //                   existingInventory.reservedQty += quantity;
  //                   existingInventory.availableQty = availableStock - quantity;
  //                   await existingInventory.save({ session });
  //               } else {
  //                   const newInventory = new InventoryModel({
  //                       productId,
  //                       startdate: formattedQuoteDate,
  //                       enddate: formattedEndDate,
  //                       slot: slotName,
  //                       reservedQty: quantity,
  //                       availableQty: availableStock - quantity,
  //                   });

  //                   await newInventory.save({ session });
  //               }
  //           }
  //       }

  //       // 🔥 STEP 2: CREATE QUOTATION AFTER STOCK CONFIRMATION
  //       const newQuotation = new Quotationmodel({
  //           clientId,
  //           quoteId: nextQuoteId,
  //           clientName,
  //           Products,
  //           clientNo,
  //           address,
  //           category,
  //           quoteDate: formattedQuoteDate,
  //           quoteTime,
  //           termsandCondition,
  //           GrandTotal,
  //           adjustments,
  //           discount,
  //           GST,
  //           status,
  //           executivename,
  //           endDate: formattedEndDate,
  //           placeaddress,
  //           slots,
  //       });

  //       await newQuotation.save({ session });

  //       // ✅ Commit transaction after all checks pass
  //       await session.commitTransaction();
  //       session.endSession();

  //       return res.json({ success: "✅ Quotation confirmed and inventory locked successfully!" });

  //   } catch (error) {
  //       await session.abortTransaction();
  //       session.endSession();
  //       console.error("❌ Error in quotation creation:", error);
  //       return res.status(500).json({ error: error.message || "Failed to create Quotation" });
  //   }
  // }

  /**
   * Reorders the products inside one slot.
   *
   * Deliberately separate from updateQuotationById: that one replaces the
   * slots wholesale and re-validates stock, so a quotation that is already
   * over-committed cannot be saved at all. Moving a row up or down is not a
   * stock change and must not be refused for one.
   *
   * The new order arrives as positions into the slot's current Products, and
   * the existing entries are permuted. Nothing is rebuilt from the request,
   * so quantities, prices, dates and icons cannot be altered or dropped here.
   */
  async reorderSlotProducts(req, res) {
    try {
      const { quotationId } = req.params;
      const { order, slotIndex = 0 } = req.body;

      if (!Array.isArray(order)) {
        return res.status(400).json({ error: "order must be an array of positions" });
      }

      const quotation = await Quotationmodel.findById(quotationId);
      if (!quotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      const slot = (quotation.slots || [])[slotIndex];
      if (!slot) {
        return res.status(404).json({ error: "Slot not found on this quotation" });
      }

      const products = slot.Products || [];

      /* The order has to be a permutation of exactly the rows that are there
         now. If it is not, the list changed under the person doing the
         dragging, and applying a stale order would move the wrong rows. */
      const isPermutation =
        order.length === products.length &&
        new Set(order).size === order.length &&
        order.every((i) => Number.isInteger(i) && i >= 0 && i < products.length);

      if (!isPermutation) {
        return res.status(409).json({
          error: "The product list changed. Reload the quotation and try again.",
        });
      }

      slot.Products = order.map((i) => products[i]);
      quotation.markModified(`slots.${slotIndex}.Products`);
      await quotation.save();

      return res.json({ success: "Product order updated", data: quotation });
    } catch (error) {
      console.error("Error reordering slot products:", error);
      return res.status(500).json({ error: "Failed to update the product order" });
    }
  }
}

const QuotationsController = new Quotations();
module.exports = QuotationsController;
