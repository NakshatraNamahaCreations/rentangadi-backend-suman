const ordermodel = require("../model/order");
const ProductManagementModel = require("../model/product");
const InventoryModel = require("../model/inventory");
const mongoose = require("mongoose");
const { parseDate } = require("../utils/dateString");
const Order = require("../model/order");
const Quotationmodel = require("../model/quotations");
const Counter = require("../model/getNextSequence");
const payment = require("../model/payment");
const moment = require("moment");

class order {
  async invoiceId(req, res) {

    // const latestCustomer = await Enquirymodel.findOne()
    //   .sort({ enquiryId: -1 })
    //   .exec();
    // const latestEquiry = latestCustomer ? latestCustomer.enquiryId : 0;
    // const newEquiry = latestEquiry + 1;
    // const enquiryId = await Counter?.getNextSequence("enquiryId");


    const latestOrder = await Order.findOne()
      .sort({ invoiceId: -1 })
      .exec();
    const latestInvoiceId = latestOrder ? latestOrder.invoiceId : 0;

    const latestInvoiceNumber = ('RA0') + await Counter?.getNextSequence("invoiceId");

    console.log("New Invoice ID:", latestInvoiceNumber);


    res.status(200).json({ message: latestInvoiceNumber })


  }

  async postaddorder(req, res) {
    console.log("post order")
    const {
      quoteId,
      userId,
      slots,
      clientId,
      executiveId,
      clientName,
      clientNo,
      executivename,
      Address,
      GrandTotal,
      refurbishmentAmount,
      paymentStatus,
      orderStatus,
      labourecharge,
      transportcharge,
      GST,
      discount,
      placeaddress,
      adjustments,
      products,
    } = req.body;
    // console.log({ quoteId })
    // console.log(JSON.stringify(slots, null, 2));


    // Start a new session for the transaction

    const session = await mongoose.startSession();


    console.log("Products: ", JSON.stringify(products, null, 2));


    try {
      // Begin the transaction
      session.startTransaction();

      // Iterate through slots
      for (const slot of slots) {
        const { products, quoteDate, endDate } = slot;

        // Convert quoteDate and endDate to Date objects
        const start = parseDate(quoteDate.trim());
        const end = parseDate(endDate.trim());

        // Validate date range
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error("Invalid start date or end date provided.");
        }
        console.log(" here 1; ",)

        for (const product of products) {
          const { productId, quantity, productName, productEndDate, productQuoteDate } = product;

          // Validate product fields
          if (!productId || !quantity || quantity <= 0) {
            throw new Error(`Invalid product details for "${productName}".`);
          }

          const inventory = await InventoryModel.find({ productId }).session(session);

          // Step 2: Check for overlapping date ranges
          const overlappingInventory = inventory.filter(item => {
            const inventoryStartDate = parseDate(item.startdate);
            const inventoryEndDate = parseDate(item.enddate);

            // Check if there's an overlap
            return inventoryStartDate <= end && inventoryEndDate >= start;
          });
          console.log("overlappingInventory: ", overlappingInventory)

          // Calculate total reserved quantity
          const totalReserved = overlappingInventory.reduce(
            (sum, item) => sum + item.reservedQty,
            0
          );

          const existingInventory = inventory.find(item =>
            item.productId === productId &&
            item.startdate === quoteDate &&
            item.enddate === endDate
          );

          const findProd = await ProductManagementModel.findById(productId).session(session);

          // // Fetch product stock if inventory entry does not exist
          // const globalStock = existingInventory
          //   ? existingInventory.reservedQty
          //   : findProd.ProductStock;

          // Check stock availability
          if (Number(findProd.ProductStock) - Number(totalReserved) < Number(quantity)) {
            console.log("findProd.ProductStock: ", findProd.ProductStock, "Number(totalReserved)  : ", Number(totalReserved), "quanity: ", quantity)
            throw new Error(`Insufficient stock for "${productName}" on ${quoteDate}.`);
          }

          product.productPrice = findProd.ProductPrice;

          const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
          const total = Number(quantity) * Number(product.productPrice) * rentalDays;
          product.total = total;

          // Update or create inventory entry
          if (existingInventory) {
            existingInventory.reservedQty += Number(quantity);
            existingInventory.availableQty -= Number(quantity);
            await existingInventory.save({ session });
          } else {
            const inventory = new InventoryModel({
              productId,
              startdate: quoteDate,
              enddate: endDate,
              reservedQty: Number(quantity),
              availableQty: findProd.ProductStock - quantity,
            });
            await inventory.save({ session });
          }
        }
      }

      const latestOrder = await Order.findOne()
        .sort({ invoiceId: -1 })
        .exec();
      const latestInvoiceId = latestOrder ? latestOrder.invoiceId : 0;

      const invoiceId = ('RA0') + await Counter?.getNextSequence("invoiceId");

      console.log("New Invoice ID:", invoiceId);

      let updatedExecutiveId = executiveId;
      if (executiveId === "") {
        updatedExecutiveId = null;
      }


      // Create the order after inventory updates
      const newOrder = new ordermodel({
        quoteId,
        clientId,
        executiveId: updatedExecutiveId,
        invoiceId,
        clientName,
        clientNo,
        executivename,
        slots,
        Address,
        GrandTotal,
        roundOff: 0,
        refurbishmentAmount,
        paymentStatus,
        orderStatus,
        labourecharge,
        transportcharge,
        GST,
        discount,
        placeaddress,
        adjustments,
        products,
      });
      console.log(" here 2; ",)

      const savedOrder = await newOrder.save({ session });

      // Quotation
      const quotation = await Quotationmodel.findOne({ quoteId });

      if (!quotation) {
        throw new Error(`message: Quotation not found`);
      }
      console.log("found quote: ", quotation)
      console.log(JSON.stringify(slots, null, 2))



      // throw new Error("just testing")


      if (quotation.slots && quotation.slots[0]) {
        console.log("map product:",)
        quotation.slots[0].Products = quotation.slots[0]?.Products.map((product) => {
          console.log("map product:", product)

          // Find the matching product in the order's slot[0].products
          const matchingProduct = slots[0].products.find(
            (orderProduct) => String(orderProduct.productId) === String(product.productId)
          );

          console.log("matching:", matchingProduct)

          if (matchingProduct) {
            console.log("found match");
            return {
              ...product,
              productQuoteDate: matchingProduct.productQuoteDate,
              productEndDate: matchingProduct.productEndDate,
              productSlot: matchingProduct.productSlot,
            };
          }
          return product;
        });

        // Update the status
        quotation.status = "send";

        // Save the updated quotation
        await quotation.save({ session });

        console.log("quotation slots prods", quotation.slots[0].Products)
      } else {
        throw new Error("No products found in the first slot of the quotation.");
      }

      // Commit the transaction if everything is successful
      await session.commitTransaction();
      session.endSession(); // End the session

      const resultQuotation = await Quotationmodel.findOne({ quoteId });
      console.log("result q: ", resultQuotation.slots[0].Products)
      res.status(201).json({
        message: "Order created successfully and inventory updated.",
        order: savedOrder,
      });
    } catch (error) {
      // Abort the transaction if there's an error
      console.error("Error creating order:", error);
      await session.abortTransaction();
      res.status(500).json({
        message: "Failed to create order and update inventory.",
        error: error.message,
      });
    } finally {
      session.endSession(); // End the session after abort
    }
  }

  // async updateOrder(req, res) {
  //   const { productId, quantity, quoteDate, endDate } = req.body;

  //   try {
  //     // Fetch the current available stock of the product
  //     const productData = await ProductManagementModel.findById(productId);
  //     if (!productData) {
  //       return res.status(404).json({
  //         message: `Product not found`
  //       });
  //     }

  //     // Check if the selected quantity exceeds the available stock
  //     if (quantity > productData.ProductStock) {
  //       return res.status(400).json({
  //         message: `Insufficient stock. Available: ${productData.ProductStock}`,
  //         availableStock: productData.ProductStock  // Send back available stock
  //       });
  //     }

  //     // Check if the inventory for the product exists within the date range
  //     const inventory = await InventoryModel.findOne({ productId, startdate: quoteDate, enddate: endDate });

  //     if (inventory) {
  //       inventory.reservedQty += quantity;
  //       inventory.availableQty -= quantity;
  //       await inventory.save();
  //     } else {
  //       // If no inventory entry, create a new one
  //       const newInventory = new InventoryModel({
  //         productId,
  //         startdate: quoteDate,
  //         enddate: endDate,
  //         reservedQty: quantity,
  //         availableQty: productData.ProductStock - quantity,
  //       });
  //       await newInventory.save();
  //     }

  //     // Update the global product stock
  //     productData.ProductStock -= quantity;
  //     await productData.save();

  //     res.status(200).json({
  //       message: "Order updated and inventory updated successfully."
  //     });

  //   } catch (error) {
  //     console.error("Error updating order:", error);
  //     res.status(500).json({
  //       message: "Failed to update order and inventory.",
  //       error: error.message,
  //     });
  //   }
  // }

  async updateOrderById(req, res) {
    console.log("inside updateOrderById")
    const { id } = req.params
    const { productId, productName, quantity, quoteDate, endDate, isNewProduct, productQuoteDate, productEndDate, productSlot } = req.body;

    // Start a new session for the transaction
    const session = await mongoose.startSession();

    try {
      session.startTransaction(); // Begin the transaction

      // Step 1: Fetch the order using the provided orderId
      const order = await Order.findById(id).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: `Order not found`
        });
      }
      console.log({ productId, quantity, quoteDate, endDate, isNewProduct, productQuoteDate, productEndDate, productSlot })
      console.log(`typesof  : `, typeof (quantity))

      // checking the inventories
      const allInventories = await InventoryModel.find({ productId: productId }).session(session);

      const inventory = await InventoryModel.findOne({
        productId,
        startdate: quoteDate,
        enddate: endDate,
      }).session(session);

      console.log("inventories: ", allInventories)

      const overlappingInventory = allInventories.filter(item => {
        // console.log(`parseDate(item.startdate): `, parseDate(item.startdate))
        // console.log(`parseDate(item.enddate): `, parseDate(item.enddate))
        const inventoryStartDate = parseDate(item.startdate);
        const inventoryEndDate = parseDate(item.enddate);
        return inventoryStartDate <= parseDate(endDate) && inventoryEndDate >= parseDate(quoteDate);
      });
      console.log("overlappingInventory: ", overlappingInventory)

      const totalReserved = overlappingInventory.reduce(
        (sum, entry) => sum + (entry.reservedQty || 0),
        0
      );

      const findProd = await ProductManagementModel.findById(productId)
        .select('ProductStock ProductPrice')
        .lean()
        .session(session);

      let availableStock = findProd.ProductStock;

      if (overlappingInventory.length > 0) {
        availableStock = Math.max(findProd.ProductStock - totalReserved, 0); // Ensure no negative stock
      }

      // if (availableStock <= 0) {
      //   throw new Error(`Insufficient stock: Available stock is 0 or less for product ${productId}`);
      // }

      console.log("availableStock: ", availableStock)


      if (!inventory) {
        console.log(`Inventory doesn't exist`)
        throw new Error(`Inventory doesn't exist`);
      }
      // console.log("found order: ", order)
      // console.log("slots[0].products: ", order.slots[0].products)
      // console.log({ quantity, inventory })


      // Update the product's quantity and total in the order's slots[0].products[]
      const slot = order.slots[0]; // Assuming you're working with the first slot

      // Find the existing product in the order
      const orderProduct = order.slots[0].products.find(prod => prod.productId.toString() === productId.toString());
      if (!orderProduct) {
        throw new Error("Product not found in order");
      }

      // Update the existing product's quantity
      const oldQuantity = orderProduct.quantity;
      const quantityDifference = quantity - oldQuantity;

      // Update the product's quantity and total
      orderProduct.quantity = quantity;
      const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
      orderProduct.total = Number(quantity) * Number(findProd.ProductPrice) * rentalDays;

      // console.log("after updating products: ", order.slots[0].products)

      if (availableStock >= quantityDifference) {
        inventory.reservedQty += quantityDifference;
        inventory.availableQty = Number(findProd.ProductStock - inventory.reservedQty);
        await inventory.save({ session });
      } else {
        throw new Error("Cannot update: Available Stock is less than desired quantity");
      }

      // // if (product && quantity <= (inventory.reservedQty + product.quantity)) {
      // if (product && quantity <= findProd.ProductStock) {
      //   inventory.reservedQty = quantity;
      //   inventory.availableQty = findProd.ProductStock - quantity;
      //   console.log("inventory.reservedQty: ", inventory.reservedQty)
      //   await inventory.save({ session });
      //   const updatedInventory = await InventoryModel.findOne({
      //     productId,
      //     startdate: quoteDate,
      //     enddate: endDate
      //   }).session(session);
      //   console.log("after updating inven: ", updatedInventory)

      // } else {
      //   // Handle the case if quantity exceeds available stock (optional)
      //   res.status(404).json({ message: "prod doesnt exist" })
      // }

      // Recalculate the grand total
      let subtotal = 0;

      // Calculate subtotal (sum of all products' total)
      order.slots.forEach(slot => {
        slot.products.forEach((prod, index) => {
          console.log(` ${index} prod: `, prod.total, `typeof `, typeof (prod.total))
          if (prod.productId.toString() === productId.toString()) {
            console.log("existing prod: ", prod)
            const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
            const total = Number(prod.quantity) * Number(findProd.ProductPrice) * rentalDays;
            prod.total = total;
            subtotal += total;
          } else {
            // Use already-stored total
            console.log("prod total: ", prod.total)
            subtotal += Number(prod.total) || 0;
          }

        });
      });
      console.log({ subtotal })

      const { labourecharge, transportcharge, discount, GST, GrandTotal, refurbishmentAmount } = order
      const discountAmt = subtotal * (Number(discount || 0) / 100);
      const totalBeforeCharges = subtotal - discountAmt;
      const totalAfterCharges = totalBeforeCharges + Number(labourecharge || 0) + Number(transportcharge || 0) + Number(refurbishmentAmount || 0);

      // Calculate GST
      const gstAmt = totalAfterCharges * (Number(GST || 0) / 100);

      // Final Grand Total
      const grandTotal = Math.round(totalAfterCharges + gstAmt);

      console.log({ discountAmt, gstAmt })

      // Step 9: Update the order's GrandTotal
      order.GrandTotal = grandTotal;
      // order.roundOff = ;

      // Save the updated order once at the end
      await order.save({ session });

      console.log({ subtotal, totalBeforeCharges, discountAmt, totalAfterCharges, gstAmt, grandTotal, labourecharge, transportcharge, discount, GST })


      // Commit the transaction if everything is successful
      await session.commitTransaction();
      session.endSession(); // End the session

      res.status(200).json({
        message: "Order updated and inventory updated successfully."
      });

    } catch (error) {
      // Abort the transaction if there's an error
      await session.abortTransaction();
      session.endSession(); // End the session after abort

      console.error("Error updating order:", error);
      res.status(500).json({
        message: "Failed to update order and inventory.",
        error: error.message,
      });
    }
  }


  /* get order data, specific prod inventory, check avaialb stats n update accordingly
  *  
  */
  async updateExistingOrderById(req, res) {
    console.log("inside updateOrderById")
    const { id } = req.params
    const { productId, quantity, quoteDate, endDate, productQuoteDate, productEndDate, productSlot } = req.body;

    // Start a new session for the transaction
    const session = await mongoose.startSession();

    try {
      session.startTransaction(); // Begin the transaction

      // Step 1: Fetch the order using the provided orderId
      const order = await Order.findById(id).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: `Order not found`
        });
      }
      console.log({ productId, quantity, quoteDate, endDate, productQuoteDate, productEndDate, productSlot })
      console.log(`typesof : `, typeof (quantity))

      // checking the inventories
      const allInventories = await InventoryModel.find({ productId: productId }).session(session);

      const inventory = await InventoryModel.findOne({
        productId,
        startdate: quoteDate,
        enddate: endDate,
      }).session(session);

      if (!inventory) {
        console.log(`Inventory doesn't exist`)
        // return res.status(400).json({ message: `Inventory doesn't exist` });
        throw new Error(`Inventory doesn't exist`);
      }

      console.log("inventories: ", allInventories)

      const overlappingInventory = allInventories.filter(item => {
        const inventoryStartDate = parseDate(item.startdate);
        const inventoryEndDate = parseDate(item.enddate);
        return inventoryStartDate <= parseDate(endDate) && inventoryEndDate >= parseDate(quoteDate);
      });
      console.log("overlappingInventory: ", overlappingInventory)

      const totalReserved = overlappingInventory.reduce(
        (sum, entry) => sum + (entry.reservedQty || 0),
        0
      );

      const findProd = await ProductManagementModel.findById(productId)
        .select('ProductStock ProductPrice')
        .lean()
        .session(session);

      let availableStock = findProd.ProductStock;

      if (overlappingInventory.length > 0) {
        availableStock = Math.max(findProd.ProductStock - totalReserved, 0); // Ensure no negative stock
      }

      console.log("availableStock: ", availableStock)

      // // Step 4: Update the product's quantity and total in the order's slots[0].products[]
      const slot = order.slots[0];

      // Find the existing product in the order
      const orderProduct = order.slots[0].products.find(prod => prod.productId.toString() === productId.toString());
      if (!orderProduct) {
        throw new Error("Product not found in order");
      }

      const productIds = order.slots[0].products.map(p => p.productId);
      const products = await ProductManagementModel.find({
        _id: { $in: productIds }
      }).select('ProductPrice');

      const priceMap = new Map(products.map(p => [p._id.toString(), p.ProductPrice]));
      console.log(`priceMap: `, priceMap);

      // Update the existing product's quantity
      const oldQuantity = orderProduct.quantity;
      const quantityDifference = quantity - oldQuantity;

      // Update the product's quantity and total
      orderProduct.quantity = quantity;
      const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
      orderProduct.total = Number(quantity) * Number(findProd.ProductPrice) * rentalDays;

      if (availableStock >= quantityDifference) {
        inventory.reservedQty += quantityDifference;
        inventory.availableQty = Number(findProd.ProductStock - inventory.reservedQty);
        await inventory.save({ session });
      } else {
        throw new Error("Cannot update: Available Stock is less than desired quantity");
      }

      // Recalculate the grand total
      let subtotal = 0;

      order.slots.forEach(slot => {
        slot.products.forEach((prod, index) => {
          prod.total = 0
          if (prod.productId.toString() === productId.toString()) {
            console.log("existing prod: ", prod)
            const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
            const total = Number(prod.quantity) * Number(findProd.ProductPrice) * rentalDays;
            prod.total += total;
            subtotal += total;
            console.log(`UPDATED ${prod.productName} total: `, prod.total, "days: ", rentalDays, 'ProductPrice: ', findProd.ProductPrice, 'prod.quantity: ', prod.quantity)
          } else {
            // Use already-stored total
            const price = priceMap.get(prod.productId.toString());
            const rentalDays = moment(prod.productEndDate, "DD-MM-YYYY").diff(moment(prod.productQuoteDate, "DD-MM-YYYY"), "days") + 1;
            const total = Number(prod.quantity) * Number(price) * rentalDays;
            prod.total += total;
            subtotal += total;
            console.log(`${prod.productName} total: `, prod.total, "days: ", rentalDays, 'ProductPrice: ', price, 'prod.quantity: ', prod.quantity)
          }
        });
      });
      console.log({ subtotal })

      const { labourecharge, transportcharge, discount, GST, GrandTotal, refurbishmentAmount } = order
      const discountAmt = subtotal * (Number(discount || 0) / 100);
      const totalBeforeCharges = subtotal - discountAmt;
      const totalAfterCharges = totalBeforeCharges + Number(labourecharge || 0) + Number(transportcharge || 0) + Number(refurbishmentAmount || 0);

      // Calculate GST
      const gstAmt = totalAfterCharges * (Number(GST || 0) / 100);

      // Final Grand Total
      const grandTotal = Math.round(totalAfterCharges + gstAmt);

      console.log({ discountAmt, gstAmt })

      // Step 9: Update the order's GrandTotal
      order.GrandTotal = grandTotal;
      // order.roundOff = ;

      await order.save({ session });

      console.log({ subtotal, totalBeforeCharges, discountAmt, totalAfterCharges, gstAmt, grandTotal, labourecharge, transportcharge, discount, GST })


      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: "Order updated and inventory updated successfully."
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error("Error updating order:", error);
      res.status(500).json({
        message: "Failed to update order and inventory.",
        error: error.message,
      });
    }
  }






  /* get order data, 
   * specific prod inventory exists/not?
   * check available stats n update accordingly
  */
  async addNewProductToOrderById(req, res) {
    console.log("inside updateOrderById")
    const { id } = req.params
    const { productId, productName, quantity, quoteDate, endDate, isNewProduct, productQuoteDate, productEndDate, productSlot } = req.body;

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Step 1: Fetch the order using the provided orderId
      const order = await Order.findById(id).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: `Order not found`
        });
      }
      console.log({ productId, quantity, quoteDate, endDate, isNewProduct, productQuoteDate, productEndDate, productSlot })
      console.log(`typesof :`, typeof (quantity))

      // checking the inventories
      const allInventories = await InventoryModel.find({ productId }).session(session);

      const inventory = await InventoryModel.findOne({
        productId,
        startdate: quoteDate,
        enddate: endDate,
      }).session(session);

      console.log("inventories: ", allInventories)

      const overlappingInventory = allInventories.filter(item => {
        const inventoryStartDate = parseDate(item.startdate);
        const inventoryEndDate = parseDate(item.enddate);
        return inventoryStartDate <= parseDate(endDate) && inventoryEndDate >= parseDate(quoteDate);
      });
      console.log("overlappingInventory: ", overlappingInventory)

      const totalReserved = overlappingInventory.reduce(
        (sum, entry) => sum + (entry.reservedQty || 0),
        0
      );

      const findProd = await ProductManagementModel.findById(productId)
        .select('ProductStock ProductPrice')
        .lean()
        .session(session);

      let availableStock = findProd.ProductStock;

      if (overlappingInventory.length > 0) {
        availableStock = Math.max(findProd.ProductStock - totalReserved, 0);
      }

      console.log("availableStock: ", availableStock)

      const slot = order.slots[0];
      const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;

      if (availableStock >= quantity) {
        if (!inventory) {
          // Create new inventory record
          const newInventory = new InventoryModel({
            productId,
            reservedQty: quantity,
            availableQty: Number(findProd.ProductStock - quantity),
            startdate: quoteDate,
            enddate: endDate
          });
          await newInventory.save({ session });
        } else {
          // Update existing inventory
          inventory.reservedQty += quantity;
          inventory.availableQty = Number(findProd.ProductStock - inventory.reservedQty);
          await inventory.save({ session });
        }
      } else {
        throw new Error("Cannot update: Available Stock is less than desired quantity");
      }
      

      // const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
      const total = Number(quantity) * Number(findProd.ProductPrice) * rentalDays;
      // product.total = total;

      const addProduct = {
        productId,
        productName,
        quantity,
        productPrice: findProd.ProductPrice,
        total,
        productQuoteDate, productEndDate, productSlot
      };
      slot.products.push(addProduct);

      const productIds = order.slots[0].products.map(p => p.productId);
      const products = await ProductManagementModel.find({
        _id: { $in: productIds }
      })
        .select('ProductPrice')
        .lean();

      const priceMap = new Map(products.map(p => [p._id.toString(), p.ProductPrice]));
      console.log(`priceMap: `, priceMap);


      let subtotal = 0;

      order.slots.forEach(slot => {
        slot.products.forEach((prod, index) => {
          prod.total = 0
          if (prod.productId.toString() === productId.toString()) {
            // console.log("existing prod: ", prod)
            const rentalDays = moment(productEndDate, "DD-MM-YYYY").diff(moment(productQuoteDate, "DD-MM-YYYY"), "days") + 1;
            const total = Number(prod.quantity) * Number(findProd.ProductPrice) * rentalDays;
            prod.total += total;
            subtotal += total;
            console.log(`ADDED ${prod.productName} total: `, prod.total, "days: ", rentalDays, 'ProductPrice: ', findProd.ProductPrice, 'prod.quantity: ', prod.quantity)
          } else {
            // Use already-stored total
            const price = priceMap.get(prod.productId.toString());
            const rentalDays = moment(prod.productEndDate, "DD-MM-YYYY").diff(moment(prod.productQuoteDate, "DD-MM-YYYY"), "days") + 1;
            const total = Number(prod.quantity) * Number(price) * rentalDays;
            prod.total += total;
            subtotal += total;
            console.log(`${prod.productName} total: `, prod.total, "days: ", rentalDays, 'ProductPrice: ', price, 'prod.quantity: ', prod.quantity)
          }
        });
      });
      console.log({ subtotal })

      const { labourecharge, transportcharge, discount, GST, GrandTotal, refurbishmentAmount } = order
      const discountAmt = subtotal * (Number(discount || 0) / 100);
      const totalBeforeCharges = subtotal - discountAmt;
      const totalAfterCharges = totalBeforeCharges + Number(labourecharge || 0) + Number(transportcharge || 0) + Number(refurbishmentAmount || 0);

      const gstAmt = totalAfterCharges * (Number(GST || 0) / 100);

      const grandTotal = Math.round(totalAfterCharges + gstAmt);

      console.log({ discountAmt, gstAmt })

      // Step 9: Update the order's GrandTotal
      order.GrandTotal = grandTotal;
      // order.roundOff = ;

      await order.save({ session });

      console.log({ subtotal, totalBeforeCharges, discountAmt, totalAfterCharges, gstAmt, grandTotal, labourecharge, transportcharge, discount, GST })


      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: "Order updated and inventory updated successfully."
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error("Error updating order:", error);
      res.status(500).json({
        message: "Failed to update order and inventory.",
        error: error.message,
      });
    }
  }






  async updateOrderFields(req, res) {
    const { orderId, roundOff } = req.body;
    console.log({ orderId, roundOff });

    if (typeof roundOff !== 'number' || isNaN(roundOff)) {
      return res.status(400).json({
        message: "Round off must be a valid number",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { roundOff },
      { new: true }
    );


    res.status(200).json({
      message: "Order updated successfully.",
      updatedOrder,
    });

  }

  // // Fetch the current available stock of the product
  // const productData = await ProductManagementModel.findById(productId).select('ProductStock').lean().session(session);
  // if (!productData) {
  //   await session.abortTransaction(); // Abort if product is not found
  //   session.endSession();
  //   return res.status(404).json({
  //     message: `Product not found`
  //   });
  // }

  // // Check if the selected quantity exceeds the available stock
  // if (quantity > productData.ProductStock) {
  //   await session.abortTransaction(); // Abort if there's insufficient stock
  //   session.endSession();
  //   return res.status(400).json({
  //     message: `Insufficient stock. Available: ${productData.ProductStock}`,
  //     availableStock: productData.ProductStock  // Send back available stock
  //   });
  // }

  async updateOrder(req, res) {
    const {
      quoteId,
      orderId,
      slots,
      ClientId,
      clientName,
      clientNo,
      executivename,
      Address,
      GrandTotal,
      paymentStatus,
      orderStatus,
      labourecharge,
      transportcharge,
      GST,
      discount,
      placeaddress,
      adjustments,
      products,
    } = req.body;

    try {
      // Iterate through slots
      for (const slot of slots) {
        const { products, quoteDate, endDate } = slot;

        // Convert quoteDate and endDate to Date objects
        const start = parseDate(quoteDate.trim());
        const end = parseDate(endDate.trim());

        // Validate date range
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            message: "Invalid start date or end date provided."
          });
        }

        for (const product of products) {
          const { productId, quantity, productName } = product;
          console.log("product: ", product)

          // Validate product fields
          if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({
              message: `Invalid product details for "${productName, quoteDate, endDate}".`,
            });
          }

          // const existingQuotation = await Quotation.find({ quoteId });
          // if (!existingQuotation) {
          //   return res.status(400).json({
          //     message: `Quotation does not exist`,
          //   });
          // }

          // check if inventory exists
          const existingOrder = await Order.find({ id: orderId });
          if (!existingOrder) {
            return res.status(400).json({
              message: `Order does not exist`,
            });
          }

          const existingInventory = await InventoryModel.find({
            productId,
            startdate: quoteDate,
            enddate: endDate
          });
          if (existingInventory) {
            return res.status(400).json({
              message: `inventory does not exist`,
            });
          }

          // Fetch product stock if inventory entry does not exist
          const globalStock = existingInventory.availableQty

          // Check stock availability
          if (globalStock < quantity) {
            return res.status(400).json({
              message: `Insufficient stock for "${productName}" on ${quoteDate}.`,
            });
          }

          // Update or create inventory entry          
          existingInventory.reservedQty += quantity;
          existingInventory.availableQty -= quantity;
          await existingInventory.save();
        }
      }

      updatedOrder.products = [...updatedOrder.products, ...products]
      updatedOrder.GrandTotal = GrandTotal;
      updatedOrder.GST = GST;
      updatedOrder.discount = discount;
      updatedOrder.adjustments = adjustments;
      updatedOrder.labourecharge = labourecharge;
      updatedOrder.transportcharge = transportcharge;


      await updatedOrder.save();

      res.status(201).json({
        message: "Order created successfully and inventory updated.",
        order: updatedOrder,
      });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({
        message: "Failed to create order and update inventory.",
        error: error.message,
      });
    }
  }

  async getTotalNumberOfOrder(req, res) {
    try {
      // Get the current date and set the time to the start of the day
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Get the current date and set the time to the end of the day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Count the total number of documents
      let totalorderCount = await ordermodel.countDocuments({});

      // Count the number of documents created today
      let todayorderCount = await ordermodel.countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      });

      return res.json({
        totalorderCount: totalorderCount,
        todayorderCount: todayorderCount,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve quotation counts" });
    }
  }

  async getallorders(req, res) {
    try {
      let data = await ordermodel.find({}).sort({ _id: -1 });
      // console.log(data,"Data nhi")
      if (data) {
        return res.json({ orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async getMyOrders(req, res) {
    const { id } = req.params;
    // const { clientId } = req;
    const objClientId = new mongoose.Types.ObjectId(id);
    console.log(`clientId: `, id);

    try {
      console.time('myOrders')
      // const data = await ordermodel.find({ clientId }).sort({ _id: -1 }).lean();
      // const total = await ordermodel.countDocuments({ clientId }).lean();

      const aggregationPipeline = [
        { $match: { clientId: objClientId } }, // Match the documents based on `clientId`
        { $sort: { createdAt: -1 } }, {    // Sort the documents by `_id` in descending order
          $lookup: {
            from: "products",  // The collection to lookup (products)
            localField: "slots.products.productId",  // Local field to match with foreign field in Product collection
            foreignField: "_id",  // Field in Product collection that we match against
            as: "productDetails"  // Name of the field where product details will be stored
          },
        }, {
          $facet: {
            total: [{ $count: "totalCount" }],   // Get the total count of documents
            data: [{ $skip: 0 }] // You can change the skip/limit based on your pagination
          }
        }
      ];

      const result = await ordermodel.aggregate(aggregationPipeline);
      console.log(`result: `, result);

      const data = result[0].data;  // The documents you wanted to fetch
      const total = result[0].total[0]?.totalCount || 0;  // The total count

      console.timeEnd('myOrders')
      if (data) {
        return res.status(200).json({ total, orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async getMyOrdersToken(req, res) {
    const { clientId } = req;
    const objClientId = new mongoose.Types.ObjectId(clientId);
    console.log(`clientId: `, clientId);

    try {
      console.time('myOrders')
      // const data = await ordermodel.find({ clientId }).sort({ _id: -1 }).lean();
      // const total = await ordermodel.countDocuments({ clientId }).lean();

      const aggregationPipeline = [
        { $match: { clientId: objClientId } }, // Match the documents based on `clientId`
        { $sort: { _id: -1 } },    // Sort the documents by `_id` in descending order
        {
          $lookup: {
            from: "products",  // The collection to lookup (products)
            localField: "slots.products.productId",  // Local field to match with foreign field in Product collection
            foreignField: "_id",  // Field in Product collection that we match against
            as: "productDetails"  // Name of the field where product details will be stored
          }
          // $addFields: {
          //   products: {
          //     $map: {
          //       input: '$products',
          //       as: 'product',
          //       in: {
          //         $mergeObjects: [
          //           '$$product',
          //           {
          //             $arrayElemAt: [
          //               {
          //                 $filter: {
          //                   input: '$productDetails',
          //                   as: 'detail',
          //                   cond: {
          //                     $eq: ['$$detail._id', '$$product.productId']
          //                   }
          //                 }
          //               },
          //               0
          //             ]
          //           }
          //         ]
          //       }
          //     }
          //   }
          // }
        },
        {
          $facet: {
            total: [{ $count: "totalCount" }],   // Get the total count of documents
            data: [{ $skip: 0 },] // You can change the skip/limit based on your pagination
          }
        }
      ];

      const result = await ordermodel.aggregate(aggregationPipeline);
      // console.log(`result: `, result);
      // console.log(`result: `, JSON.stringify(result, null, 2));

      const data = result[0].data;  // The documents you wanted to fetch
      const total = result[0].total[0]?.totalCount || 0;  // The total count

      console.timeEnd('myOrders')
      if (data) {
        return res.json({ total, orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async getOrderById(req, res) {
    const { id } = req.params; // Get the order ID from the route params
    console.log("id: ", id)

    try {
      // // Find the order by its ID
      // const order = await Order.findById(id)
      //   .populate('clientId') // Optionally, populate related fields if needed (e.g., client details)
      //   .populate('products.productId') // Optionally, populate product details if needed
      //   .exec();
      const order = await Order.findById(id).lean()

      // If no order found, return a 404 response
      if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
      }

      const payments = await payment.find({ quotationId: order.quoteId }).lean();

      // if (order?.slots && order.slots[0]?.products) {
      const updatedProducts = await Promise.all(order.slots[0].products.map(async (product) => {
        // Fetch product data once using ProductManagementModel.find and lean to get a plain object
        const productData = await ProductManagementModel.findById(product.productId)
          .select('ProductStock ProductPrice ProductIcon')
          .lean(); // Use lean to get a plain JavaScript object

        console.log("productData: ", productData); // productData will now be a plain object

        // If product data is found, inject ProductStock, else return the product as is
        if (productData) {
          console.log("adding ProductStock"); // productData will now be a plain object
          return {
            ...product,  // Spread the existing product details
            ProductStock: productData.ProductStock,  // Inject the fetched ProductStock
            ProductPrice: productData.ProductPrice,
            ProductIcon: productData.ProductIcon
          };
        }

        // If no product data is found, return the product as is
        return product;
      }));

      // Log the updated products for debugging
      // console.log("updatedProducts: ", updatedProducts);


      // Update the slot with the updated products
      const updatedSlot = {
        ...order.slots[0],  // Use the first slot from the order directly
        products: updatedProducts,  // Add the updated products array to the slot
      };

      // Update the order with the updated slot
      const updatedOrder = {
        ...order,
        payments,
        slots: [updatedSlot],  // Wrap the updated slot in an array again
      };

      // Log the updated products for debugging
      // console.log("updatedProducts: ", updatedProducts);

      // Return the found order as a response
      return res.status(200).json({ order: updatedOrder });
    } catch (error) {
      // Handle errors (e.g., invalid ObjectId format, database issues)
      console.error(error);
      return res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
  };

  async deleteProductInOrderById(req, res) {
    const { id } = req.params
    const { productId, quoteDate, endDate } = req.body;

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Step 1: Fetch the order
      const order = await Order.findById(id).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Order not found" });
      }

      // Step 2: Find the product in the order and remove it
      const slot = order.slots[0]; // Assuming you are dealing with the first slot
      const productIndex = slot.products.findIndex(prod => prod.productId.toString() === productId);
      if (productIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Product not found in order" });
      }

      // Remove product from the order
      const [removedProduct] = slot.products.splice(productIndex, 1);

      // Step 3: Update the inventory
      const inventory = await InventoryModel.findOne({
        productId: removedProduct.productId,
        startdate: quoteDate,
        enddate: endDate
      }).session(session);

      if (inventory) {
        // Reduce reservedQty for this product in the inventory
        inventory.reservedQty -= removedProduct.quantity;
        inventory.availableQty += removedProduct.quantity;

        // Save the updated inventory
        await inventory.save({ session });
      }

      // Step 4: Recalculate the order total
      let subtotal = 0;
      order.slots.forEach(slot => {
        slot.products.forEach(prod => {
          subtotal += prod.total; // Add each product's total to the subtotal
        });
      });

      // Apply discount, transport, and other charges
      const { labourecharge, transportcharge, discount, GST, refurbishmentAmount } = order;
      // subtotal += Number(labourecharge || 0) + Number(transportcharge || 0);

      // Apply discount
      const discountAmt = subtotal * (Number(discount || 0) / 100);
      const totalBeforeCharges = subtotal - discountAmt;
      const totalAfterCharges = totalBeforeCharges + Number(labourecharge || 0) + Number(transportcharge || 0) + Number(refurbishmentAmount || 0);

      // Calculate GST
      const gstAmt = totalAfterCharges * (Number(GST || 0) / 100);

      // Final Grand Total
      const grandTotal = Math.round(totalAfterCharges + gstAmt);

      // Step 5: Update the GrandTotal in the order
      order.GrandTotal = grandTotal;
      // order.roundOff = ;

      // Save the updated order
      await order.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Product deleted from order and inventory updated successfully" });

    } catch (error) {
      // Abort the transaction if there's an error
      await session.abortTransaction();
      session.endSession();
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product from order and update inventory", error: error.message });
    }
  }

  async getfindwithClientID(req, res) {
    try {
      const id = req.params.id;
      let data = await ordermodel.find({ ClientId: id }).sort({ _id: -1 });
      if (data) {
        return res.json({ orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async getApprovedOrders(req, res) {
    try {
      const data = await ordermodel
        .find({ orderStatus: { $in: ["Approved", "Delivered", "Returned"] } })
        .sort({ _id: -1 });

      if (data.length > 0) {
        return res.json({ orderData: data });
      } else {
        return res.status(404).json({ error: "No orders found" });
      }
    } catch (error) {
      console.error("Error retrieving orders:", error); // Log the error for debugging
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  }

  async updateStatus(req, res) {
    try {
      const id = req.params.id; // Extract the order ID from the URL
      const { orderStatus } = req.body; // Extract orderStatus from the request body

      // Log received data for debugging
      console.log("Order ID:", id);
      console.log("New Order Status:", orderStatus);

      if (!id) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      if (!orderStatus) {
        return res.status(400).json({ error: "Order status is required" });
      }

      // Perform the update operation
      const orderDetails = await ordermodel.findOneAndUpdate(
        { _id: id }, // Query condition: Match by ID
        { orderStatus }, // Update operation: Set new status
        { new: true } // Return the updated document
      );

      if (orderDetails) {
        return res.status(200).json({
          success: true,
          message: "Order status updated successfully",
          orderDetails,
        });
      } else {
        return res.status(404).json({ error: "Order not found" });
      }
    } catch (error) {
      console.error("Error in updateStatus:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async refurbishment(req, res) {
    try {
      const { id } = req.params;
      const {
        productrefurbishment,
        damagerefurbishment,
        shippingaddressrefurbishment,
        expense,
        floormanager,
      } = req.body;
      const existingRefurbishment = await ordermodel.findById(id);
      if (!existingRefurbishment) {
        return res.status(404).json({ message: "Refurbishment not found" });
      }
      const updatedData = {
        productrefurbishment:
          productrefurbishment || existingRefurbishment.productrefurbishment,
        damagerefurbishment:
          damagerefurbishment || existingRefurbishment.damagerefurbishment,
        shippingaddressrefurbishment:
          shippingaddressrefurbishment ||
          existingRefurbishment.shippingaddressrefurbishment,
        expense: expense || existingRefurbishment.expense,
        floormanager: floormanager || existingRefurbishment.floormanager,
      };
      const updatedRefurbishment = await ordermodel.findByIdAndUpdate(
        id,
        updatedData,
        { new: true }
      );
      if (!updatedRefurbishment) {
        return res.status(404).json({ message: "Refurbishment not found" });
      }
      return res.status(200).json({
        message: "Refurbishment updated successfully",
        data: updatedRefurbishment,
      });
    } catch (error) {
      console.error("Error updating refurbishment:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // product sales
  async getHighestAndLowestProductSales(req, res) {
    try {
      const productSales = await ProductManagementModel.aggregate([
        {
          $lookup: {
            from: "orders", // Join with the orders collection
            localField: "_id", // Match Product _id
            foreignField: "products.productId", // Match productId in orders
            as: "orderDetails",
          },
        },
        {
          $unwind: {
            path: "$orderDetails",
            preserveNullAndEmptyArrays: true, // Include products with no orders
          },
        },
        {
          $unwind: {
            path: "$orderDetails.products",
            preserveNullAndEmptyArrays: true, // Include products with no matching sales
          },
        },
        {
          $match: {
            $expr: { $eq: ["$orderDetails.products.productId", "$_id"] }, // Match product IDs
          },
        },
        {
          $group: {
            _id: "$_id", // Group by ProductId
            productName: { $first: "$ProductName" }, // Product name from the product collection
            totalSales: {
              $sum: {
                $cond: [
                  { $ifNull: ["$orderDetails.products.quantity", false] }, // Check if quantity exists
                  "$orderDetails.products.quantity", // Sum quantities
                  0, // If no sales, set to 0
                ],
              },
            },
          },
        },
        { $sort: { totalSales: -1 } }, // Sort by total sales descending
        { $limit: 5 }, // Limit to top 5 products
      ]);

      res.status(200).json({
        success: true,
        topProducts: productSales,
      });
    } catch (error) {
      console.error("Error calculating product sales:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // async getHighestAndLowestProductSales(req, res) {
  //   try {
  //     const productSales = await ProductManagementModel.aggregate([
  //       {
  //         $lookup: {
  //           from: "orders", // Join with the orders collection
  //           localField: "_id", // Match ProductId in products
  //           foreignField: "products.ProductId", // Match ProductId in orders
  //           as: "orderDetails",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$orderDetails",
  //           preserveNullAndEmptyArrays: true, // Include products with no orders
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$orderDetails.products",
  //           preserveNullAndEmptyArrays: true, // Include products with no matching sales
  //         },
  //       },
  //       {
  //         $match: {
  //           $expr: { $eq: ["$orderDetails.products.ProductId", "$_id"] }, // Match product IDs
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: "$_id", // Group by ProductId
  //           productName: { $first: "$ProductName" }, // Product name from the product collection
  //           totalSales: {
  //             $sum: {
  //               $cond: [
  //                 { $ifNull: ["$orderDetails.products.qty", false] },
  //                 "$orderDetails.products.qty",
  //                 0, // If no sales, set to 0
  //               ],
  //             },
  //           },
  //         },
  //       },
  //       { $sort: { totalSales: -1 } }, // Sort by total sales descending
  //       { $limit: 5 }, // Limit to top 5 products
  //     ]);

  //     res.status(200).json({
  //       success: true,
  //       topProducts: productSales,
  //     });
  //   } catch (error) {
  //     console.error("Error calculating product sales:", error);
  //     res.status(500).json({ error: "Internal server error" });
  //   }
  // }

  // category sales

  async getCategorySales(req, res) {
    try {
      const categorySales = await ProductManagementModel.aggregate([
        {
          $lookup: {
            from: "orders", // Join with orders collection
            localField: "_id", // Match Product _id
            foreignField: "products.productId", // Match productId in orders
            as: "orderDetails",
          },
        },
        {
          $unwind: {
            path: "$orderDetails",
            preserveNullAndEmptyArrays: true, // Include products with no orders
          },
        },
        {
          $unwind: {
            path: "$orderDetails.products",
            preserveNullAndEmptyArrays: true, // Include products with no matching sales
          },
        },
        {
          $match: {
            $expr: { $eq: ["$orderDetails.products.productId", "$_id"] }, // Match product IDs
          },
        },
        {
          $group: {
            _id: "$ProductCategory", // Group by ProductCategory
            totalSales: {
              $sum: {
                $cond: [
                  { $ifNull: ["$orderDetails.products.quantity", false] }, // Check if quantity exists
                  "$orderDetails.products.quantity", // Sum quantities
                  0, // If no quantity, add 0
                ],
              },
            },
          },
        },
        { $sort: { totalSales: -1 } }, // Sort categories by total sales descending
        {
          $project: {
            categoryName: "$_id", // Rename _id to categoryName
            totalSales: 1,
          },
        },
      ]);

      res.status(200).json({
        success: true,
        categorySales,
      });
    } catch (error) {
      console.error("Error calculating category sales:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getHighestAndLowestProductSalesdate(req, res) {
    try {
      const { fromDate, toDate } = req.query;

      // Ensure `fromDate` and `toDate` are provided
      if (!fromDate || !toDate) {
        return res
          .status(400)
          .json({ error: "fromDate and toDate are required" });
      }

      const productSales = await ProductManagementModel.aggregate([
        {
          $lookup: {
            from: "orders", // Join with the orders collection
            localField: "_id", // Match ProductId in products
            foreignField: "products.ProductId", // Match ProductId in orders
            as: "orderDetails",
          },
        },
        {
          $unwind: {
            path: "$orderDetails",
            preserveNullAndEmptyArrays: true, // Include products with no orders
          },
        },
        {
          $unwind: {
            path: "$orderDetails.products",
            preserveNullAndEmptyArrays: true, // Include products with no matching sales
          },
        },
        {
          $match: {
            $and: [
              { $expr: { $eq: ["$orderDetails.products.ProductId", "$_id"] } }, // Match product IDs
              {
                $expr: {
                  $and: [
                    { $gte: ["$orderDetails.startDate", new Date(fromDate)] }, // Filter by fromDate
                    { $lte: ["$orderDetails.startDate", new Date(toDate)] }, // Filter by toDate
                  ],
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: "$_id", // Group by ProductId
            productName: { $first: "$ProductName" }, // Product name from the product collection
            totalSales: {
              $sum: {
                $cond: [
                  { $ifNull: ["$orderDetails.products.qty", false] },
                  "$orderDetails.products.qty",
                  0, // If no sales, set to 0
                ],
              },
            },
          },
        },
        { $sort: { totalSales: -1 } }, // Sort by total sales descending
        { $limit: 5 }, // Limit to top 5 products
      ]);

      res.status(200).json({
        success: true,
        topProducts: productSales,
      });
    } catch (error) {
      console.error("Error calculating product sales:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getProductSalesData(req, res) {
    try {
      const { productId } = req.params;
      console.log("ProductId received:", productId);

      // Validate productId format
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ error: "Invalid ProductId format" });
      }

      // Convert productId to ObjectId
      const ObjectId = mongoose.Types.ObjectId;
      const productObjectId = new ObjectId(productId);

      const productSales = await ordermodel.aggregate([
        {
          $unwind: {
            path: "$products", // Decompose products array
            preserveNullAndEmptyArrays: true, // Prevent removal of orders with no products
          },
        },
        {
          $match: {
            "products.productId": productObjectId, // Match the productId field
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$startDate" } }, // Group by startDate
            totalSales: { $sum: "$products.quantity" }, // Sum quantities sold
          },
        },
        { $sort: { _id: 1 } }, // Sort by date in ascending order
      ]);

      // Format data for response
      const formattedData = productSales.map((item) => ({
        date: item._id,
        totalSales: item.totalSales,
      }));

      res.status(200).json({
        success: true,
        data: formattedData,
      });
    } catch (error) {
      console.error("Error fetching product sales data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // cancelation product
  // async cancelOrder(req, res) {
  //   const { orderId } = req.body;
  //   console.log(orderId, "orderId");

  //   try {
  //     const order = await ordermodel.findById(orderId);
  //     if (!order) return res.status(404).json({ error: "Order not found" });

  //     const { slots = [] } = order;

  //     for (const slot of slots) {
  //       const { slotName, quoteDate, endDate, products = [] } = slot;

  //       for (const product of products) {
  //         const { productId, quantity } = product;

  //         // Update the inventory
  //         const inventory = await InventoryModel.findOne({
  //           productId,
  //           slot: slotName,
  //           startdate: quoteDate,
  //           enddate: endDate,
  //         });

  //         if (inventory) {
  //           inventory.reservedQty -= quantity;
  //           inventory.availableQty += quantity;

  //           // Ensure values are not negative
  //           inventory.reservedQty = Math.max(0, inventory.reservedQty);
  //           inventory.availableQty = Math.max(0, inventory.availableQty);

  //           await inventory.save();
  //         } else {
  //           console.warn("Inventory not found for:", {
  //             productId,
  //             slot: slotName,
  //             startdate: quoteDate,
  //             enddate: endDate,
  //           });
  //         }
  //       }
  //     }

  //     // Mark the order as cancelled
  //     order.orderStatus = "cancelled";
  //     await order.save();

  //     return res
  //       .status(200)
  //       .json({ message: "Order cancelled and inventory updated." ,});
  //   } catch (err) {
  //     console.error("Error cancelling order:", err);
  //     return res.status(500).json({ error: "Internal server error" });
  //   }
  // }
  // async cancelOrder(req, res) {
  //   const { orderId } = req.body;
  //   console.log("Received Order ID for Cancellation:", orderId);

  //   try {
  //     const order = await ordermodel.findById(orderId);
  //     if (!order) {
  //       console.error("❌ Order not found for ID:", orderId);
  //       return res.status(404).json({ error: "Order not found" });
  //     }

  //     console.log("✅ Found Order:");
  //     console.log("Client:", order.clientName);
  //     console.log("Slots:", order.slots.length);

  //     const { slots = [] } = order;

  //     for (const slot of slots) {
  //       console.log(`\n🔄 Processing Slot: ${slot.slotName}`);
  //       console.log("Start Date:", slot.quoteDate);
  //       console.log("End Date:", slot.endDate);
  //       console.log("Products in this slot:", slot.products.length);

  //       for (const product of slot.products) {
  //         const { productId, quantity } = product;

  //         console.log(`➡️ Updating inventory for Product ID: ${productId}`);
  //         console.log("Quantity to return:", quantity);

  //         const inventory = await InventoryModel.findOne({
  //           productId,
  //           slot: slot.slotName,
  //           startdate: slot.quoteDate,
  //           enddate: slot.endDate,
  //         });

  //         if (inventory) {
  //           console.log("✅ Found Inventory Before Update:", {
  //             reservedQty: inventory.reservedQty,
  //             availableQty: inventory.availableQty,
  //           });

  //           inventory.reservedQty = Math.max(
  //             0,
  //             inventory.reservedQty - quantity
  //           );
  //           inventory.availableQty = Math.max(
  //             0,
  //             inventory.availableQty + quantity
  //           );

  //           await inventory.save();

  //           console.log("✅ Inventory Updated:", {
  //             reservedQty: inventory.reservedQty,
  //             availableQty: inventory.availableQty,
  //           });
  //         } else {
  //           console.warn("⚠️ Inventory record not found for:", {
  //             productId,
  //             slot: slot.slotName,
  //             startdate: slot.quoteDate,
  //             enddate: slot.endDate,
  //           });
  //         }
  //       }
  //     }

  //     // Mark the order as cancelled
  //     order.orderStatus = "cancelled";
  //     await order.save();
  //     console.log("✅ Order status updated to 'cancelled'");

  //     return res.status(200).json({
  //       message: "Order cancelled and inventory updated.",
  //     });
  //   } catch (err) {
  //     console.error("🔥 Error cancelling order:", err);
  //     return res.status(500).json({ error: "Internal server error" });
  //   }
  // }

  async cancelOrder(req, res) {
    const { orderId } = req.body;
    console.log("Received Order ID for Cancellation:", orderId);

    const session = await mongoose.startSession(); // Start a new session for the transaction

    try {
      // Begin the transaction
      session.startTransaction();

      // Fetch the order to be canceled
      const order = await ordermodel.findById(orderId).session(session);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // // Fetch and inject ProductStock for each product in order.slots[0].products
      // order.slots[0].products = await Promise.all(
      //   order.slots[0].products.map(async (product) => {
      //     // Fetch the product data using ProductManagementModel.findById
      //     const productData = await ProductManagementModel.findById(product.productId)
      //       .select('ProductStock')  // Only select the ProductStock field
      //       .lean();  // Use lean to get a plain JavaScript object (faster and no Mongoose magic)

      //     // If product data is found, inject ProductStock
      //     if (productData) {
      //       console.log(`productData found, ${product.productId}, ${product.productName}, ${productData.ProductStock}`);
      //       return {
      //         ...product,  // Spread the existing product details
      //         ProductStock: productData.ProductStock,  // Inject the ProductStock value
      //       };
      //     }

      //     // If no product data is found, return the product as it is
      //     return product;
      //   })
      // );

      // console.log("Updated Order with ProductStock:", order.slots[0].products);


      // Access the first slot (order.slots[0])
      const firstSlot = order.slots[0]; // Referring to the first slot
      const { quoteDate, endDate, products } = firstSlot;
      // console.log("firstslot : ", firstSlot)

      // Update inventory for each product in the first slot
      for (const product of products) {
        const { productId, quantity, ProductStock } = product;
        // console.log("product : ", product)
        console.log("quantity: ", quantity, "typeof: ", typeof (quantity))


        // Find the inventory entry for the product in this slot
        const inventory = await InventoryModel.findOne({
          productId,
          startdate: quoteDate,
          enddate: endDate,
        }).session(session);

        if (inventory) {
          // Release the reserved quantity back to available stock
          inventory.reservedQty -= quantity;
          inventory.availableQty += quantity;
          await inventory.save({ session }); // Save the updated inventory
        }
        // console.log("updated inventory***: ", inventory)
      }
      // Update order status to "cancelled"
      order.orderStatus = "cancelled";
      // order.slots[0].products = []
      await order.save({ session });

      // throw new Error("just testing")

      // Commit the transaction if everything is successful
      await session.commitTransaction();

      return res.status(200).json({
        order,
        message: "Order cancelled and inventory updated successfully.",
      });
    } catch (error) {
      // If any error occurs, abort the transaction
      console.error("Error cancelling order:", error);

      // Abort the transaction if there's an error
      await session.abortTransaction();

      return res.status(500).json({
        error: "Internal server error. Failed to cancel order and update inventory.",
      });
    } finally {
      session.endSession();
    }
  }



  // async cancelOrder(req, res) {
  //   const { orderId } = req.body;
  //   console.log("Received Order ID for Cancellation:", orderId);

  //   try {
  //     const order = await ordermodel.findById(orderId);
  //     if (!order) {
  //       return res.status(404).json({ error: "Order not found" });
  //     }

  //     // Get all slots from the order
  //     const slots = order.slots || [];

  //     // Update inventory for each slot
  //     for (const slot of slots) {
  //       const { products, quoteDate, endDate } = slot;

  //       // Loop through each product in the slot
  //       for (const product of products) {
  //         const { productId, quantity } = product;

  //         // Find and update the inventory entry
  //         const inventory = await InventoryModel.findOne({
  //           productId,
  //           startdate: quoteDate,
  //           enddate: endDate,
  //         });

  //         if (inventory) {
  //           // Release the reserved quantity back to available
  //           inventory.availableQty += quantity;
  //           inventory.reservedQty -= quantity;
  //           await inventory.save();
  //         }
  //       }
  //     }

  //     // Update order status to cancelled
  //     order.orderStatus = "cancelled";
  //     await order.save();

  //     return res.status(200).json({
  //       message: "Order cancelled and inventory updated.",
  //     });
  //   } catch (error) {
  //     console.error("Error cancelling order:", error);
  //     return res.status(500).json({ error: "Internal server error" });
  //   }
  // }
}

const orderController = new order();
module.exports = orderController;
