const mongoose = require("mongoose");
const Enquirymodel = require("../model/enquiry");
const listCache = require("../utils/listCache");
const Counter = require("../model/getNextSequence");
const Inventory = require("../model/inventory");
const Clientmodel = require("../model/clients");
const Quotationmodel = require("../model/quotations");
const ProductManagementModel = require("../model/product");
const { compareDates } = require("../utils/dateString");
const OrderModel = require("../model/order"); // ✅ update if your model file name is orders/orderModel
const moment = require("moment");
const Order = require("../model/order"); // ✅ adjust path to your Order model



class Enquiry {

  async createEnquiry(req, res) {
    const {
      clientId,
      executiveId,
      enquiryDate,
      enquiryTime,
      endDate,
      clientName,
      executivename,
      clientNo,
      address,
      products,
      category,
      status,
      GrandTotal,
      adjustments,
      discount,
      termsandCondition,
      GST,
      placeaddress,
    } = req.body;

    console.log(`createEnquiry clientId: `, clientId);

    console.log(placeaddress);

    const areDatesValid = compareDates(endDate, enquiryDate)
    if (!areDatesValid) {
      return res.status(400).json({ message: "Dismantle Date must be same or less than Delivery Date" })
    }

    try {

      const processedProducts = products.map((product, index) => {
        console.log(`product: `, product);
        const qty = parseInt(product.qty, 10);
        const price = parseInt(product.price, 10);
        const total = parseInt(product.total, 10);

        // Validate qty
        if (isNaN(qty) || qty <= 0) {
          // return res.status(400).json({ message: `Invalid quantity in ${product.ProductName}. Must be a number greater than 0.` });
          // throw new Error(`Invalid quantity in ${product.name}. Qty Must be > 0.`);
          throw new Error(`Each product must have quantity of at least 1`);
        }

        return {
          ...product,
          qty,
          price,
          total,
        };
      });


      // console.log(`processedProducts products: `, processedProducts);

      // const latestCustomer = await Enquirymodel.findOne()
      //   .sort({ enquiryId: -1 })
      //   .exec();
      // const latestEquiry = latestCustomer ? latestCustomer.enquiryId : 0;
      // const newEquiry = latestEquiry + 1;
      const enquiryId = await Counter?.getNextSequence("enquiryId");

      let updatedExecutiveId = executiveId;
      if (executiveId === "") {
        updatedExecutiveId = null;
      }

      const clientIdObj = new mongoose.Types.ObjectId(clientId);
      console.log(`clientIdObj: `, clientIdObj);



      // return res.status(400).json({ message: 'working on enquiry' })

      // Create a new Enquiry with the incremented enquiryId
      const newEnquiry = new Enquirymodel({
        clientId,
        executiveId: updatedExecutiveId,
        enquiryId,
        clientName,
        executivename,
        endDate,
        products: processedProducts,
        clientNo,
        address,
        category,
        enquiryDate,
        enquiryTime,
        termsandCondition,
        GrandTotal,
        adjustments,
        discount,
        GST,
        status,
        placeaddress,
      });

      // Save the new Enquiry to the database
      const savedEnquiry = await newEnquiry.save();
      // console.log(`savedEnquiry: `, savedEnquiry);

      if (savedEnquiry) {
        return res.json({ success: "Enquiry created successfully" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message || "Failed to create Enquiry" });
    }
  }

  async updateEnquiries(req, res) {
    let { id } = req.params;
    let { GrandTotal, adjustments, discount, GST, hasBeenUpdated } = req.body;
    console.log(GrandTotal, adjustments, discount, GST);
    try {
      const enquiry = await Enquirymodel.findByIdAndUpdate({ _id: id });
      if (GrandTotal !== undefined) enquiry.GrandTotal = GrandTotal;
      if (adjustments !== undefined) enquiry.adjustments = adjustments;
      if (discount !== undefined) enquiry.discount = discount;
      if (GST !== undefined) enquiry.GST = GST;
      if (hasBeenUpdated !== undefined) enquiry.hasBeenUpdated = true;

      const updatedEnquiry = await enquiry.save();
      console.log(updatedEnquiry, "wrwwy9");
      return res
        .status(200)
        .json({ success: "Enquiry updated successfully", updatedEnquiry });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to update Enquiry" });
    }
  }

  async getTotalAndTodayEnquiryCount(req, res) {
    try {
      // Get the current date and set the time to the start of the day
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Get the current date and set the time to the end of the day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Count the total number of documents
      let totalEnquiryCount = await Enquirymodel.countDocuments({});

      // Count the number of documents created today
      let todayEnquiryCount = await Enquirymodel.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      });

      return res.json({
        totalEnquiryCount: totalEnquiryCount,
        todayEnquiryCount: todayEnquiryCount,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve Enquiry counts" });
    }
  }

  async updateenquiryfollowup(req, res) {
    let { followupStatus } = req.body;
    let enquiryId = req.params.id;

    try {
      const enquiryData = await Enquirymodel.findOneAndUpdate(
        { _id: enquiryId },
        { followupStatus: followupStatus }
      );

      if (enquiryData) {
        return res.status(200).json({ success: "updated succesfully" });
      }
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async getEnquiryaggredata(req, res) {
    const id = req.params.id;

    try {
      const Data = await Enquirymodel.find({ _id: id });

      if (Data.length > 0) {
        return res.json({ EnquiryData: Data });
      } else {
        return res.status(404).json({ error: "No data found" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to retrieve data" });
    }
  }

  /* ?limit and ?page paginate; ?full=1 returns every field. With neither,
     the response is the same bare array it always was. */
  async allEnquiry(req, res) {
    try {
      const limit = Math.max(0, parseInt(req.query.limit, 10) || 0);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const full = String(req.query.full || "") === "1";
      const LIST_FIELDS =
        "enquiryId clientName clientNo enquiryDate enquiryTime executivename " +
        "executiveId GrandTotal status createdAt";

      /* Only the plain call is cached; paginated ones are already fast. */
      const isDefaultCall = !limit && !full;
      if (isDefaultCall) {
        const hit = listCache.get(listCache.KEYS.enquiries);
        if (hit) return res.status(200).json(hit);
      }

      const q = Enquirymodel.find({})
        .populate("executiveId", "name")
        .sort({ _id: -1 });
      if (!full) q.select(LIST_FIELDS);
      if (limit > 0) q.skip((page - 1) * limit).limit(limit);
      const enquiryData = await q.lean();
      if (isDefaultCall) listCache.set(listCache.KEYS.enquiries, enquiryData);

      if (enquiryData) {
        return res.status(200).json(enquiryData);
      }
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async getMyEnquiries(req, res) {
    const { id } = req.params;
    try {
     const enquiryData = await Enquirymodel.find({ clientId: id })
  .sort({ createdAt: -1 })
  .lean();
      console.log("getMyEnquiries enquiryData: ", enquiryData.map(item => item.enquiryId));

      if (enquiryData) {
        return res.status(200).json({ enquiryData: enquiryData });
      }

      res.json(enquiryData)
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // async getEnquiryById(req, res) {
  //   const { id } = req.params;
  //   try {
  //     const enquiryData = await Enquirymodel.findOne({ _id: id });
  //     // console.log("enquirydata: ", enquiryData)

  //     const enrichedWithProducts = await Promise.all(
  //       enquiryData.products.map(async (product) => {
  //         // Fetch the product from ProductManagementModel using the productId
  //         const productData = await ProductManagementModel.findOne({ _id: product.productId });

  //         // Log the productData to debug
  //         // console.log("Product Data: ", productData);

  //         // If the product exists, extract the stock; otherwise, default to 0 stock
  //         const productStock = productData ? productData.ProductStock : 0;

  //         // Return the enriched product with updated stock
  //         return {
  //           ...product,          // Spread the existing product data
  //           stock: productStock, // Inject the stock value into the product
  //         };
  //       })
  //     );

  //     enquiryData.products = enrichedWithProducts;

  //     // console.log("enquirudata*********************: ", enquiryData)




  //     if (enquiryData.clientId) {
  //       // Fetch client info using clientId from enquiryData
  //       const clientDetails = await Clientmodel.findById(enquiryData.clientId);
  //       // console.log("clientData: ", clientData)

  //       // Add client info to response
  //       const enrichedResponse = {
  //         ...enquiryData.toObject(),  // convert Mongoose doc to plain object
  //         clientDetails   // add full client object or select fields
  //       };
  //       // console.log("enquiry client enrichedResponse: ", enrichedResponse)

  //       if (enquiryData.status === "sent") {
  //         const quotationData = await Quotationmodel.findOne({ enquiryId: enquiryData.enquiryId });
  //         console.log(`quotationData: `, quotationData);

  //         const quotationEnrichedResponse = {
  //           ...enquiryData.toObject(),  // convert Mongoose doc to plain object
  //           clientDetails,   // add full client object or select fields
  //           quotationData
  //         };
  //         // console.log("enquiry quotation enriched: ", quotationEnrichedResponse)
  //         return res.status(200).json({ enrichedResponse: quotationEnrichedResponse });
  //       }

  //       if (enquiryData && clientDetails) {
  //         return res.status(200).json({ enrichedResponse });
  //       }
  //     }


  //     if (enquiryData) {
  //       return res.status(200).json({ enrichedResponse: enquiryData });
  //     }
  //   } catch (error) {
  //     console.error("Something went wrong", error);
  //     return res.status(500).json({ error: "Internal server error" });
  //   }
  // }

  async getEnquiryById(req, res) {
    const { id } = req.params;

    try {
      const enquiryData = await Enquirymodel.findById(id)
        .populate({
          path: "clientId",
          select: "_id phoneNumber name email", // ✅ only these fields
        })
        .populate({
          path: "executiveId",
          select: "-password",
        });

      if (!enquiryData) {
        return res.status(404).json({ error: "Enquiry not found" });
      }

      // ✅ Enrich enquiry products with latest ProductStock
      const enrichedWithProducts = await Promise.all(
        (enquiryData.products || []).map(async (product) => {
          try {
            const productData = await ProductManagementModel.findById(product.productId).lean();
            const productStock = productData ? Number(productData.ProductStock || 0) : 0;
            return { ...product, stock: productStock };
          } catch (e) {
            return { ...product, stock: 0 };
          }
        })
      );

      enquiryData.products = enrichedWithProducts;

      // ✅ quotationData full (keep)
      let quotationData = null;

      // ✅ only return orderSlots
      let orderSlots = [];
      let hasConfirmedOrder = false;

      if (String(enquiryData.status) === "sent") {
        quotationData = await Quotationmodel.findOne({
          enquiryId: enquiryData.enquiryId,
        }).lean();

        if (quotationData?.quoteId) {
          const orderDoc = await Order.findOne({
            quoteId: quotationData.quoteId,
            orderStatus: { $in: ["Confirm", "Approved", "Completed"] },
          })
            .select("slots")
            .lean();

          if (orderDoc?.slots?.length) {
            orderSlots = orderDoc.slots;
            hasConfirmedOrder = true;
          }
        }
      }

      const enrichedResponse = {
        ...enquiryData.toObject(),

        // ✅ IMPORTANT: use populated objects here
        clientDetails: enquiryData.clientId || null,
        executiveDetails: enquiryData.executiveId || null,

        quotationData,
        orderSlots,
        hasConfirmedOrder,
      };

      return res.status(200).json({ enrichedResponse });
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }



  async postdeleteEnquiry(req, res) {
    const { id } = req.params;
    try {
      const data = await Enquirymodel.deleteOne({ _id: id });
      if (data.deletedCount > 0) {
        return res.json({ success: "Successfully deleted" });
      } else {
        return res.status(404).json({ error: "Enquiry not found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete Enquiry" });
    }
  }

  // async updateEnquiry(req, res) {
  //   try {
  //     const id = req.params.id; // Extract enquiry ID from the URL
  //     const updateData = req.body; // Extract fields to update from the request body

  //     // Log received data for debugging
  //     console.log("Enquiry ID:", id);
  //     console.log("Update Data:", updateData);

  //     // Validate required fields
  //     if (!id) {
  //       return res.status(400).json({ error: "Enquiry ID is required" });
  //     }

  //     // Perform the update operation
  //     const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
  //       { _id: id }, // Query condition: Match by ID
  //       updateData, // Update operation: Use the received fields to update
  //       { new: true } // Return the updated document
  //     );

  //     if (updatedEnquiry) {
  //       return res.status(200).json({
  //         success: true,
  //         message: "Enquiry updated successfully",
  //         enquiry: updatedEnquiry,
  //       });
  //     } else {
  //       return res.status(404).json({ error: "Enquiry not found" });
  //     }
  //   } catch (error) {
  //     console.error("Error in updateEnquiry:", error);
  //     return res.status(500).json({ error: "Internal Server Error" });
  //   }
  // }


  async updateEnquiry(req, res) {
    try {
      const id = req.params.id;
      const updateData = { ...req.body };

      if (!id) return res.status(400).json({ error: "Enquiry ID is required" });

      // ✅ executiveId optional: if empty => remove it
      if (updateData.executiveId === "" || updateData.executiveId === null || updateData.executiveId === undefined) {
        delete updateData.executiveId;
      } else {
        // if provided => must be valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(updateData.executiveId)) {
          return res.status(400).json({ error: "Invalid executiveId" });
        }
      }

      // Optional: if you allow clientId update, validate it too
      if (updateData.clientId && !mongoose.Types.ObjectId.isValid(updateData.clientId)) {
        return res.status(400).json({ error: "Invalid clientId" });
      }

      const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
        { _id: id },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedEnquiry) return res.status(404).json({ error: "Enquiry not found" });

      return res.status(200).json({
        success: true,
        message: "Enquiry updated successfully",
        enquiry: updatedEnquiry,
      });
    } catch (error) {
      console.error("Error in updateEnquiry:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
  async addProductsToEnquiry(req, res) {
    const { id, products, adjustment = 0 } = req.body;
    // console.log("Request Body: ", req.body);
    console.log("products: ", products);

    try {
      // Find the enquiry by clientId
      const enquiry = await Enquirymodel.findOne({ _id: id });

      if (!enquiry) {
        return res.status(404).json({ error: "Enquiry not found" });
      }

      // Validate products array
      if (!Array.isArray(products) || products.length === 0) {
        return res
          .status(400)
          .json({ error: "Products must be a non-empty array" });
      }

      // Merge or add products
      // Merge or add products
      products.forEach((newProduct) => {
        const existingIndex = enquiry.products.findIndex(
          (p) => String(p.productId) === String(newProduct.productId)
        );

        if (existingIndex !== -1) {
          const existing = enquiry.products[existingIndex];
          existing.qty += newProduct.qty;
          existing.total = existing.qty * existing.price;
        } else {
          enquiry.products.push(newProduct);
        }
      });


      // Recalculate grand total
      const productTotal = enquiry.products.reduce(
        (sum, product) => sum + product.price * product.qty,
        0
      );

      // // Append new products to the existing products array
      // enquiry.products = [...(enquiry.products || []), ...products];

      // // Calculate the new grand total
      // const productTotal = enquiry.products.reduce(
      //   (sum, product) => sum + product.price * product.quantity,
      //   0
      // );
      const updatedGrandTotal = Math.max(0, productTotal - adjustment || 0);

      // Update enquiry fields
      enquiry.grandTotal = updatedGrandTotal;
      enquiry.adjustment = adjustment;

      // Save the updated enquiry
      const updatedEnquiry = await enquiry.save();
      console.log("Updated Enquiry: ", updatedEnquiry?.products.map((p) => p.name));

      return res.status(200).json({
        success: "Products added successfully",
        data: updatedEnquiry,
      });
    } catch (error) {
      console.error("Error adding products to enquiry:", error.message);
      return res
        .status(500)
        .json({ error: "Failed to add products to Enquiry" });
    }
  }

  async updateProductData(req, res) {
    const { id } = req.params; // Enquiry ID
    const { productId, quantity, price, productName } = req.body; // Product ID and updated quantity

    try {
      // Find the enquiry document
      // const enquiry = await Enquirymodel.findOne({ _id: id });
      const enquiry = await Enquirymodel.findOne({ enquiryId: id });

      console.log("enquiry productId, quantity,price: ", productId, quantity, price, productName)

      if (!enquiry) {
        return res.status(404).json({ error: "Enquiry not found" });
      }

      // Find the product in the products array
      const productIndex = enquiry.products.findIndex(
        (product) => product.productId === productId
      );

      if (productIndex === -1) {
        const newProduct = {
          productId: productId,
          name: productName,
          qty: quantity,
          price: price || 0, // Default to 0 if price is not provided
          total: quantity * (price || 0), // Calculate total based on quantity and price
        };

        // Add the new product to the products array
        enquiry.products.push(newProduct);

        // Recalculate GrandTotal (sum of all product totals)
        const newGrandTotal = enquiry.products.reduce(
          (sum, product) => sum + product.total,
          0
        );

        // Save the updated enquiry document
        const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
          { enquiryId: id },
          {
            $push: { products: newProduct },
            $set: { GrandTotal: newGrandTotal },
          },
          { new: true } // Return the updated document
        );

        console.log("Updated Enquiry: ", updatedEnquiry);

        return res.status(200).json({
          success: "Product created and GrandTotal updated successfully",
          data: updatedEnquiry,
        });
      }


      // Update quantity and total for the selected product
      enquiry.products[productIndex].qty = quantity;
      enquiry.products[productIndex].total =
        quantity * enquiry.products[productIndex].price;

      console.log("enquiry: ", enquiry)

      // Recalculate GrandTotal (sum of all product totals)
      const newGrandTotal = enquiry.products.reduce(
        (sum, product) => sum + product.total,
        0
      );

      // Update the document in the database
      const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
        { enquiryId: id, "products.productId": productId },
        {
          $set: {
            "products.$.qty": quantity,
            "products.$.total": quantity * enquiry.products[productIndex].price,
            "GrandTotal": newGrandTotal
          }
        },
        { new: true } // Return the updated document
      );

      console.log("updatedEnquiry: ", updatedEnquiry)

      return res.status(200).json({
        success: "Product quantity and GrandTotal updated successfully",
        data: updatedEnquiry,
      });

    } catch (error) {
      console.error("Error updating products in enquiry:", error.message);
      return res
        .status(500)
        .json({ error: "Failed to update product in Enquiry" });
    }
  }

  async deleteProductFromEnquiry(req, res) {
    const { id } = req.params;
    const { productId } = req.body;
    console.log("productId: ", productId)

    try {
      // Find the enquiry document
      const enquiry = await Enquirymodel.findOne({ enquiryId: id });

      if (!enquiry) {
        return res.status(404).json({ error: "Enquiry not found" });
      }

      const updatedProducts = enquiry.products.filter(
        (product) => product.productId !== productId
      );

      if (updatedProducts.length === enquiry.products.length) {
        return res.status(404).json({ error: "Product not found in enquiry" });
      }

      const newGrandTotal = updatedProducts.reduce(
        (sum, product) => sum + product.total,
        0
      );

      // Update the enquiry document
      const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
        { enquiryId: id },
        {
          $set: {
            products: updatedProducts,
            GrandTotal: newGrandTotal
          }
        },
        { new: true } // Return the updated document
      );

      return res.status(200).json({
        success: "Product removed successfully",
        data: updatedEnquiry,
      });

    } catch (error) {
      console.error("Error removing product from enquiry:", error.message);
      return res
        .status(500)
        .json({ error: "Failed to remove product from enquiry" });
    }
  }

  async addProductToEnquiry(req, res) {
    const { id } = req.params;
    const { productId, productName, quantity, price, StockAvailable } = req.body;
    console.log(price, "price")
    console.log("id not fount");
    try {
      const enquiry = await Enquirymodel.findOne({ _id: id });

      if (!enquiry) {
        return res.status(404).json({ error: "Enquiry not found" });
      }

      const existingProduct = enquiry.products.find(
        (product) => product.productId === productId
      );

      if (existingProduct) {
        return res.status(400).json({ error: "Product already exists in enquiry" });
      }
      const numericPrice = Number(price) || 0;
      const numericQuantity = Number(quantity) || 0;
      const totalPrice = numericPrice * numericQuantity;

      const newProduct = {
        productId,
        productName,
        quantity: numericQuantity, // ✅ Ensure numeric value
        price: numericPrice,
        total: totalPrice,
        StockAvailable,
      };

      // Push the new product into the products array
      enquiry.products.push(newProduct);

      // Recalculate GrandTotal (sum of all product totals)
      const newGrandTotal = enquiry.products.reduce(
        (sum, product) => sum + product.total,
        0
      );

      // Update the enquiry document
      const updatedEnquiry = await Enquirymodel.findOneAndUpdate(
        { _id: id },
        {
          $set: { GrandTotal: newGrandTotal },
          $push: { products: newProduct }, // Add the new product to the array
        },
        { new: true } // Return the updated document
      );

      return res.status(200).json({
        success: "New product added successfully and GrandTotal updated",
        data: updatedEnquiry,
      });

    } catch (error) {
      console.error("Error adding product to enquiry:", error.message);
      return res.status(500).json({ error: "Failed to add product to enquiry" });
    }
  }

  // by sonali
 async getRelatedEnquiriesByQuotationId(req, res) {
  try {
    const quotationId = req.query.quotationId;

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    if (!quotationId || !mongoose.Types.ObjectId.isValid(quotationId)) {
      return res.status(400).json({ message: "Valid quotationId (Mongo ObjectId) is required" });
    }

    // 1) Find quotation by mongo _id
    const quotation = await Quotationmodel.findById(quotationId).lean();
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });

    // ✅ this enquiry must be skipped
    const skipEnquiryId = quotation.enquiryId; // Number
    // If your quotation sometimes doesn't have enquiryId, keep it null-safe
    const shouldSkip = typeof skipEnquiryId === "number" && !Number.isNaN(skipEnquiryId);

    const slots = Array.isArray(quotation.slots) ? quotation.slots : [];
    if (slots.length === 0) {
      return res.status(200).json({
        quotationId,
        total: 0,
        page,
        limit,
        data: [],
        message: "Quotation has no slots to match",
      });
    }

    // 2) Collect unique (quoteDate,endDate) pairs from slots
    const slotPairs = slots
      .map((s) => ({
        quoteDate: s?.quoteDate ? String(s.quoteDate) : null,
        endDate: s?.endDate ? String(s.endDate) : null,
      }))
      .filter((x) => x.quoteDate && x.endDate);

    if (slotPairs.length === 0) {
      return res.status(200).json({
        quotationId,
        total: 0,
        page,
        limit,
        data: [],
        message: "Quotation slots missing quoteDate/endDate",
      });
    }

    // 3) Collect all productIds from slots.Products[]
    const slotProductIds = slots
      .flatMap((s) => (Array.isArray(s.Products) ? s.Products : []))
      .map((p) => (p?.productId != null ? String(p.productId) : null))
      .filter(Boolean);

    const uniqueProductIds = [...new Set(slotProductIds)];

    if (uniqueProductIds.length === 0) {
      return res.status(200).json({
        quotationId,
        total: 0,
        page,
        limit,
        data: [],
        message: "Quotation slots have no products to match",
      });
    }

    // 4) Build $or for matching enquiry date pairs
    const dateOr = slotPairs.map((p) => ({
      enquiryDate: p.quoteDate,
      endDate: p.endDate,
    }));

    // 5) Aggregate enquiries: match dates + overlap products + paginate
    const pipeline = [
      {
        $match: {
          $or: dateOr,
          ...(shouldSkip ? { enquiryId: { $ne: skipEnquiryId } } : {}),
        },
      },
      {
        $addFields: {
          matchedProducts: {
            $filter: {
              input: "$products",
              as: "p",
              cond: { $in: [{ $toString: "$$p.productId" }, uniqueProductIds] },
            },
          },
        },
      },
      {
        $match: {
          $expr: { $gt: [{ $size: "$matchedProducts" }, 0] },
        },
      },

      { $set: { products: "$matchedProducts" } },
      { $unset: "matchedProducts" },

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: "total" }],
        },
      },
      {
        $addFields: {
          total: { $ifNull: [{ $arrayElemAt: ["$meta.total", 0] }, 0] },
        },
      },
      { $project: { meta: 0 } },
    ];

    const aggRes = await Enquirymodel.aggregate(pipeline);
    const result = aggRes?.[0] || { data: [], total: 0 };

    return res.status(200).json({
      quotationId,
      skippedEnquiryId: shouldSkip ? skipEnquiryId : null, // ✅ for debugging
      slotCount: slots.length,
      matchPairs: dateOr,
      baseProductsCount: uniqueProductIds.length,
      total: result.total,
      page,
      limit,
      data: result.data,
      hasMore: skip + result.data.length < result.total,
    });
  } catch (err) {
    console.error("getRelatedEnquiriesByQuotationId error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
}

const EnquiryController = new Enquiry();
module.exports = EnquiryController;

