const ProductManagementModel = require("../model/product");
const InventoryModel = require("../model/inventory");
const listCache = require("../utils/listCache");
const XLSX = require("xlsx");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const { cloudinary } = require("../config/cloudinary");

/**
 * Units on the shelf.
 *
 * ProductStock is derived, never decremented: it is the total less whatever
 * is away for repair or written off. Recomputing it means a repaired unit
 * coming back - repairCount going down - puts the stock back by itself.
 *
 * Only finite numbers are taken from the request. Number(undefined) is NaN,
 * and NaN ?? 0 is still NaN, which is how ProductStock could be set to
 * something unusable by a form that simply did not carry the field.
 */
const stockFrom = (total, repair, lost) => {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return Math.max(0, num(total) - num(repair) - num(lost));
};

const generateSKU = () => {
  const chars = "0123456789";
  let sku = "SKU";
  for (let i = 0; i < 3; i++) {
    // Generate 3 random digits
    sku += chars[Math.floor(Math.random() * chars.length)];
  }
  return sku;
};

/**
 * Builds the product list with live stock figures.
 *
 * Shared by the request handler and the background cache refresh, so the
 * refresh does the real work instead of reading back what it is replacing.
 */
const buildProductList = async () => {
  /* This used to be one aggregate whose $lookup matched inventories on a
     $toString of the product _id. An $expr like that cannot use the index on
     inventories.productId, so the whole inventory collection was scanned once
     per product - 269 products against 8,800 rows, about eighteen seconds.
     Two reads that each bring back only what is needed replace it. */

  /* Reservations that already ended cannot affect availability, so they are
     dropped in the database rather than shipped here and skipped. The dates
     are stored as strings in two formats, DD-MM-YYYY for most rows and
     YYYY-MM-DD for some legacy ones, so both are tried. That turns 7,950
     rows into about 200. */
  const today = moment().startOf("day");
  const endAsDate = {
    $dateFromString: {
      dateString: "$enddate",
      format: "%d-%m-%Y",
      onError: {
        $dateFromString: {
          dateString: "$enddate",
          format: "%Y-%m-%d",
          onError: null,
        },
      },
    },
  };

  const [products, reservations] = await Promise.all([
    /* images is the heaviest field on a product and nothing on the list reads
       it, nor Dates; leaving them out halves the read. */
    ProductManagementModel.find({})
      .select("-images -Dates")
      .sort({ createdAt: -1 })
      .lean(),
    InventoryModel.aggregate([
      { $match: { reservedQty: { $gt: 0 } } },
      { $addFields: { _end: endAsDate } },
      { $match: { _end: { $gte: today.toDate() } } },
      {
        $project: {
          productId: 1,
          reservedQty: 1,
          startdate: 1,
          enddate: 1,
        },
      },
    ]),
  ]);

  const byProduct = new Map();
  for (const inv of reservations) {
    const key = String(inv.productId);
    const list = byProduct.get(key);
    if (list) list.push(inv);
    else byProduct.set(key, [inv]);
  }

  // Compute live StockAvailable based on the NEAREST upcoming blocked day:
  //   1. Expand each non-past inventory reservation into its daily slots,
  //      summing reservedQty per day across overlapping rows.
  //   2. Pick the earliest day that has any reservation.
  //   3. availableStock = ProductStock - reservedQty on that earliest day.
  // When that reservation is released (reservedQty -> 0) the next blocked
  // day automatically takes over; when none remain, we fall back to
  // ProductStock (full availability).

  // Inventory rows exist in two date formats in the DB:
  // "DD-MM-YYYY" (most) and "YYYY-MM-DD" (a few legacy rows).
  // Accept both so we do not silently ignore real reservations.
  const parseInvDate = (str) => {
    const m = moment(str, ["DD-MM-YYYY", "YYYY-MM-DD"], true);
    return m.isValid() ? m : null;
  };

  const withLiveStock = products.map((prod) => {
    const productStock = Number(prod.ProductStock) || 0;

    const dailyReservedMap = {};
    for (const inv of byProduct.get(String(prod._id)) || []) {
      const qty = Number(inv?.reservedQty) || 0;
      if (qty <= 0) continue;
      const start = parseInvDate(inv?.startdate);
      const end = parseInvDate(inv?.enddate);
      if (!start || !end) continue;
      if (end.isBefore(today)) continue;
      const cursor = start.isBefore(today) ? today.clone() : start.clone();
      while (cursor.isSameOrBefore(end)) {
        const key = cursor.format("YYYY-MM-DD");
        dailyReservedMap[key] = (dailyReservedMap[key] || 0) + qty;
        cursor.add(1, "day");
      }
    }

    const sortedKeys = Object.keys(dailyReservedMap).sort();
    const nearestBlockedDay = sortedKeys[0] || null;
    const blockedOnNearest = nearestBlockedDay
      ? dailyReservedMap[nearestBlockedDay]
      : 0;
    const stockAvailable = Math.max(0, productStock - blockedOnNearest);

    /* The joined inventory rows are not sent: nothing reads them, and they
       were well over a megabyte of the response. */
    return {
      ...prod,
      StockAvailable: stockAvailable,
      TotalReserved: blockedOnNearest,
      NearestBlockedDay: nearestBlockedDay,
    };
  });

  return withLiveStock;
};

class ProductManagement {
  async addProductManagement(req, res) {
    console.log("inside addProductManagement");
    try {
      let {
        ProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        offerPrice,
        ProductGst,
        Productdetails,
        qty,
        minqty,
        ProductStock,
        repairCount,
        activeStatus,
        Material,
        ProductSize,
        Color,
        seater,
        ProductImg1,
        ProductImg2,
        ProductImg3,
        // ProductSKU,
      } = req.body;
      // Cloudinary: file.path = secure_url. These are full URLs now.
      let file = req.files[0]?.path;
      let file1 = req.files[1]?.path;
      let file2 = req.files[2]?.path;
      let file3 = req.files[3]?.path;

      console.log({
        ProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        offerPrice,
        ProductGst,
        Productdetails,
        qty,
        minqty,
        ProductStock,
        repairCount,
        activeStatus,
        Material,
        ProductSize,
        Color,
        seater,
        ProductImg1,
        ProductImg2,
        ProductImg3,
        // ProductSKU,
      })
      console.log(ProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        offerPrice,
        ProductGst,
        Productdetails,
        qty,
        minqty,
        ProductStock,
        repairCount,
        activeStatus,
        Material,
        ProductSize,
        Color,
        seater, file, "etst")
      const newProductStock = stockFrom(qty, repairCount, 0);
      // const product = await ProductManagementModel.findOne()
      //   .sort({ ProductSKU: -1 })
      //   .exec();
      // const lastProductSku = product ? product.ProductSKU : "SKU001";

      // console.log("lastProductSku", lastProductSku);
      // Extract the numeric part and increment it
      // const numericPart = parseInt(lastProductSku.slice(3), 10) + 1;
      // console.log("numericPart", numericPart);

      // Pad the number with leading zeros to ensure it stays 3 digits
      // const newProductSKU = "SKU" + numericPart.toString().padStart(3, "0");

      // console.log(newProductSKU, "newProductSKU"); // Outputs SKU002, SKU003, etc.

      // 🔥 Normalize before checking
      const normalizedProductName = ProductName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

      // 🔥 Check if product already exists using normalized field
      const existed = await ProductManagementModel.findOne({ normalizedProductName });

      if (existed) {
        return res.status(400).json({
          message: "Product with this name already exists.",
        });
      }


      let add = new ProductManagementModel({
        ProductName: ProductName.trim(),
        normalizedProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        ProductGst,
        Productdetails,
        ProductStock: newProductStock,
        /* A new product has nothing away for repair or written off unless the
           form says so, and StockAvailable starts level with the stock. */
        repairCount: Number(repairCount) || 0,
        lostCount: 0,
        StockAvailable: newProductStock,
        qty,
        Material,
        ProductSize,
        Color,
        seater,
        minqty,
        offerPrice,
        ProductIcon: file,
        ProductImg1: file1,
        ProductImg2: file2,
        ProductImg3: file3,
        activeStatus,
        // ProductSKU: newProductSKU,
      });
      console.log()
      add.save().then((data) => {
        return res
          .status(200)
          .json({ success: "User added successfully", data });
      });

    } catch (error) {
      console.log("error: ", error);
      return res.status(500).json({ error: "something went wrong" });
    }
  }

  // //edit ProductManagement
  // async editProductManagement(req, res) {
  //   let id = req.params.id;
  //   let {
  //     ProductName,
  //     ProductCategory,
  //     ProductSubcategory,
  //     ProductDesc,
  //     ProductFeature,
  //     ProductPrice,
  //     ProductGst,
  //     Productdetails,
  //     qty,
  //     maxGty,
  //     ProductStock,
  //     activeStatus,
  //     Material,
  //     ProductSize,
  //     Color,
  //     seater,
  //     ProductImg1,
  //     ProductImg2,
  //     ProductImg3,
  //   } = req.body;
  //   let file = req.files && req.files[0]?.filename;

  //   try {
  //     let data = await ProductManagementModel.findOneAndUpdate(
  //       { _id: id },
  //       {
  //         ProductName,
  //         ProductCategory,
  //         ProductSubcategory,
  //         ProductDesc,
  //         ProductFeature,
  //         ProductPrice,
  //         ProductGst,
  //         Productdetails,
  //         qty,
  //         maxGty,
  //         ProductStock,
  //         activeStatus,
  //         Material,
  //         ProductSize,
  //         Color,
  //         seater,
  //         ProductImg1,
  //         ProductImg2,
  //         ProductImg3,
  //       },
  //       { new: true } // Make sure to include this to return the updated document
  //     );

  //     if (data) {
  //       return res.json({ success: "Updated", Product: data });
  //     } else {
  //       return res
  //         .status(404)
  //         .json({ success: false, message: "Data not found" });
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     return res.status(500).json({ success: false, message: "Server error" });
  //   }
  // }

  async editProductManagement(req, res) {
    const id = req.params.id;
    const {
      ProductName,
      ProductCategory,
      ProductSubcategory,
      ProductDesc,
      ProductFeature,
      ProductPrice,
      ProductGst,
      Productdetails,
      qty,
      maxGty,
      ProductStock,
      repairCount,
      lostCount,
      activeStatus,
      Material,
      ProductSize,
      Color,
      seater,
      ProductImg1,
      ProductImg2,
      ProductImg3,
      minqty, // add if needed
    } = req.body;
    // Cloudinary: file.path = secure_url.
    let file = req.files && req.files[0]?.path;

    let updateObj = {
      ProductName,
      ProductCategory,
      ProductSubcategory,
      ProductDesc,
      ProductFeature,
      ProductPrice,
      ProductGst,
      Productdetails,
      qty,
      maxGty,
      ProductStock,
      activeStatus,
      Material,
      ProductSize,
      Color,
      seater,
      ProductImg1,
      ProductImg2,
      ProductImg3,
      minqty,
    };
    if (file) {
      updateObj.ProductIcon = file;
    }

    try {
      const findProduct = await ProductManagementModel.findById(id);
      if (!findProduct) {
        return res.status(404).json({ error: "No such record found" });
      }

      let updated = {
        ProductName: findProduct.ProductName,
        normalizedProductName: findProduct.normalizedProductName,
      };


      if (ProductName) {
        // 🔥 Normalize before checking
        const normalizedProductName = ProductName
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ");

        // 🔥 Check if product already exists using normalized field
        const existed = await ProductManagementModel.findOne({
          _id: { $ne: id }, // Exclude current product
          normalizedProductName,
        });


        if (existed) {
          return res.status(400).json({
            message: "Product with this name already exists.",
          });
        }

        updated.ProductName = ProductName.trim()
        updated.normalizedProductName = normalizedProductName;
      }

      /* Total less repair less lost. The edit form carries repairCount but
         not lostCount, so anything written off was being handed back as
         stock the moment the product was edited; the stored count stands
         unless the request actually sends one. */
      const keep = (sent, stored) => {
        /* An empty field is the form not carrying a value, not a zero.
           Number("") is 0, which would quietly hand damaged units back. */
        const given = typeof sent === "string" ? sent.trim() : sent;
        if (given === "" || given === null || given === undefined) {
          return Number(stored) || 0;
        }
        return Number.isFinite(Number(given)) ? Number(given) : Number(stored) || 0;
      };

      const newRepairCount = keep(repairCount, findProduct.repairCount);
      const newLostCount = keep(lostCount, findProduct.lostCount);
      const newQty = keep(qty, findProduct.qty);

      const newProductStock = stockFrom(newQty, newRepairCount, newLostCount);


      // ✅ Handle single image update
      const updatedFields = {
        ProductName: updated.ProductName,
        normalizedProductName: updated.normalizedProductName,
        ProductCategory: ProductCategory ?? findProduct.ProductCategory,
        ProductSubcategory:
          ProductSubcategory ?? findProduct.ProductSubcategory,
        ProductFeature: ProductFeature ?? findProduct.ProductFeature,
        ProductPrice: ProductPrice ?? findProduct.ProductPrice,
        // offerPrice: offerPrice ?? findProduct.offerPrice,
        qty: newQty,
        ProductStock: newProductStock,
        repairCount: newRepairCount,
        lostCount: newLostCount,
        ProductDesc: ProductDesc ?? findProduct.ProductDesc,
        Material: Material ?? findProduct.Material,
        ProductSize: ProductSize ?? findProduct.ProductSize,
        Color: Color ?? findProduct.Color,
        seater: seater ?? findProduct.seater,

        // ✅ Keep the old image if no new image is uploaded
        ProductIcon: req.files ? file : findProduct.ProductIcon,
      };

      Object.keys(updatedFields).forEach(
        (key) => updatedFields[key] === undefined && delete updatedFields[key]
      );

      // ✅ Update product in the database
      const updatedProduct = await ProductManagementModel.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }
      );

      return res.json({
        message: "Product updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async getMismatchedProducts(req, res) {
    try {

      const query = {
        // $expr: { $ne: ["$qty", "$ProductStock"] },
        $expr: {
          $ne: [{ $toInt: "$qty" }, "$ProductStock"],
        },
      };

      // // Fields you want to show
      // const projection = {
      //   ProductName: 1,
      //   ProductSKU: 1,
      //   qty: 1,
      //   ProductStock: 1,
      //   StockAvailable: 1,
      //   ProductStatus: 1,
      // };

      // const mismatchedProducts = await ProductManagementModel.find(query, projection).lean();
      const mismatchedProducts = await ProductManagementModel.find(query).lean();

      console.log(`Mismatched products count: ${mismatchedProducts.length}`);
      // console.log(JSON.stringify(mismatchedProducts, null, 2));
      console.log(`mismatchedProducts prods: `, mismatchedProducts.map(item => [item._id, item.ProductName, item.ProductStock, item.qty]));
      console.log(`end `,);

      return res.status(200).json({
        message: "mismatchedProducts Fetched successfully",
        data: mismatchedProducts,
      });
    }
    catch (error) {
      console.log(`err: `, error);
      return res.status(500).json({ error });
      return res.status(500).json({ error: "Failed to fetch damaged products" });
    }
  }

  async getDamagedProducts0(req, res) {
    try {

      const query = {
        // $expr: { $ne: ["$qty", "$ProductStock"] },
        $expr: {
          $ne: [{ $toInt: "$qty" }, "$ProductStock"],
        },
      };

      // Fields you want to show
      const projection = {
        ProductName: 1,
        ProductSKU: 1,
        qty: 1,
        ProductStock: 1,
        StockAvailable: 1,
        ProductStatus: 1,
      };

      const mismatchedProducts = await ProductManagementModel.find(query, projection).lean();
      // const mismatchedProducts = await Product.find(query).lean();

      console.log(`Mismatched products count: ${mismatchedProducts.length}`);
      // console.log(JSON.stringify(mismatchedProducts, null, 2));
      console.log(`damaged prods: `, mismatchedProducts.map(item => [item._id, item.ProductName, item.ProductStock, item.qty]));

      return res.status(200).json({
        message: "Product updated successfully",
        data: mismatchedProducts,
      });
    }
    catch (error) {
      console.log(`err: `, error);
      return res.status(500).json({ error });
      return res.status(500).json({ error: "Failed to fetch damaged products" });
    }
  }

  async getDamagedProducts(req, res) {
    try {

      const damagedProducts = await ProductManagementModel.find({
        $or: [
          { lostCount: { $gt: 0 } },
          { repairCount: { $gt: 0 } }
        ]
      }).lean();


      return res.status(200).json({
        message: "Product damaged data fetched successfully",
        data: damagedProducts,
      });
    }
    catch (error) {
      console.log(`err: `, error);
      return res.status(500).json({ error });
      return res.status(500).json({ error: "Failed to fetch damaged products" });
    }
  }

  async editDamagedProductManagement(req, res) {
    const { productId, repairCount, lostCount, repairDescription } = req.body;

    console.log(`repairCount ${repairCount}`);
    console.log(`lostCount ${lostCount}`);
    console.log(`productId ${productId}`);

    // start trasnaction
    const session = await mongoose.startSession();
    session.startTransaction();


    if (!productId || repairCount == null || lostCount == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {

      const updatedProduct = await ProductManagementModel.findByIdAndUpdate(
        { _id: productId },
        { repairCount, lostCount, repairDescription },
        { new: true }
      ).session(session);

      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // updatedProduct.ProductStock = Number(updatedProduct.qty) - (Number(updatedProduct.repairCount) + Number(updatedProduct.lostCount));

      const updatedStock = stockFrom(
        updatedProduct.qty,
        updatedProduct.repairCount,
        updatedProduct.lostCount
      );
      const totalDamaged =
        (Number(updatedProduct.repairCount) || 0) +
        (Number(updatedProduct.lostCount) || 0);

      /* Checked against the total rather than the clamped stock, which can
         never go below zero and so could never trip this. */
      if (totalDamaged > (Number(updatedProduct.qty) || 0)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          error: "Damaged + Lost quantity must not exceed Total Qty",
        });
      }

      const updatedProductStock = await ProductManagementModel.findByIdAndUpdate(
        { _id: productId },
        { ProductStock: updatedStock },
        { new: true }
      ).session(session);

      await session.commitTransaction();

      return res.status(200).json({
        message: "Product updated successfully",
        data: updatedProduct,
      });
    }
    catch (error) {
      await session.abortTransaction();
      return res.status(500).json({ error: "Failed to update product" });
    } finally {
      session.endSession();
    }
  }

  // async updateProducts(req, res) {
  //   try {
  //     const ProductId = req.params.id;
  //     const {
  //       ProductName,
  //       ProductCategory,
  //       ProductSubcategory,
  //       ProductDesc,
  //       ProductFeature,
  //       ProductPrice,
  //       offerPrice,
  //       ProductGst,
  //       Productdetails,
  //       qty,
  //       maxGty,
  //       ProductStock,
  //       activeStatus,
  //       Material,
  //       ProductSize,
  //       Color,
  //       seater,
  //       ProductImg1,
  //       ProductImg2,
  //       ProductImg3,
  //     } = req.body; // Changed from req.params to req.body assuming form-data or JSON body

  //     let file = req.files && req.files[0]?.filename; // Check if req.files exists first
  //     let file1 = req.files && req.files[1]?.filename;
  //     let file2 = req.files && req.files[2]?.filename;
  //     let file3 = req.files && req.files[3]?.filename;
  //     const findProduct = await ProductManagementModel.findOne({
  //       _id: ProductId,
  //     });
  //     if (!findProduct) {
  //       return res.status(404).json({ error: "No such record found" });
  //     }

  //     // Update product fields
  //     findProduct.ProductName = ProductName || findProduct.ProductName;
  //     findProduct.ProductCategory =
  //       ProductCategory || findProduct.ProductCategory;
  //     findProduct.ProductSubcategory =
  //       ProductSubcategory || findProduct.ProductSubcategory;
  //     findProduct.ProductFeature = ProductFeature || findProduct.ProductFeature;
  //     findProduct.ProductPrice = ProductPrice || findProduct.ProductPrice;
  //     findProduct.offerPrice = offerPrice || findProduct.offerPrice;
  //     findProduct.Productdetails = Productdetails || findProduct.Productdetails;
  //     findProduct.qty = qty || findProduct.qty;
  //     findProduct.ProductDesc = ProductDesc || findProduct.ProductDesc;
  //     findProduct.ProductGst = ProductGst || findProduct.ProductGst;
  //     findProduct.maxGty = maxGty || findProduct.maxGty;
  //     findProduct.activeStatus = activeStatus || findProduct.activeStatus;
  //     findProduct.ProductStock = ProductStock || findProduct.ProductStock;
  //     findProduct.Material = Material || findProduct.Material;
  //     findProduct.ProductSize = ProductSize || findProduct.ProductSize;
  //     findProduct.Color = Color || findProduct.Color;
  //     findProduct.seater = seater || findProduct.seater;
  //     findProduct.ProductImg1 = ProductImg1 || findProduct.ProductImg1;
  //     findProduct.ProductImg2 = ProductImg2 || findProduct.ProductImg2;
  //     findProduct.ProductImg3 = ProductImg3 || findProduct.ProductImg3;
  //     if (file) {
  //       findProduct.ProductIcon = file;
  //     }
  //     if (file) {
  //       findProduct.ProductIcon = file;
  //     }

  //     console.log("findProduct", findProduct);
  //     const updatedProduct = await findProduct.save();

  //     return res.json({
  //       message: "Updated successfully",
  //       data: updatedProduct,
  //     });
  //   } catch (error) {
  //     console.error("Error updating product:", error);
  //     return res.status(500).json({ error: "Unable to update the product" });
  //   }
  // }
  // async updateProducts(req, res) {
  //   try {
  //     const ProductId = req.params.id;
  //     const {
  //       ProductName,
  //       ProductCategory,
  //       ProductSubcategory,
  //       ProductDesc,
  //       ProductFeature,
  //       ProductPrice,
  //       offerPrice,
  //       ProductGst,
  //       Productdetails,
  //       qty,
  //       maxGty,
  //       ProductStock,
  //       activeStatus,
  //       Material,
  //       ProductSize,
  //       Color,
  //       seater,
  //     } = req.body;

  //     const files = req.files || [];
  //     const uploadedFiles = {
  //       ProductIcon: files[0]?.filename,
  //       ProductImg1: files[1]?.filename,
  //       ProductImg2: files[2]?.filename,
  //       ProductImg3: files[3]?.filename,
  //     };

  //     // Find the product by ID
  //     const findProduct = await ProductManagementModel.findById(ProductId);
  //     if (!findProduct) {
  //       return res.status(404).json({ error: "No such record found" });
  //     }

  //     // Update product fields conditionally
  //     const updatedFields = {
  //       ProductName: ProductName || findProduct.ProductName,
  //       ProductCategory: ProductCategory || findProduct.ProductCategory,
  //       ProductSubcategory: ProductSubcategory || findProduct.ProductSubcategory,
  //       ProductFeature: ProductFeature || findProduct.ProductFeature,
  //       ProductPrice: ProductPrice || findProduct.ProductPrice,
  //       offerPrice: offerPrice || findProduct.offerPrice,
  //       Productdetails: Productdetails || findProduct.Productdetails,
  //       qty: qty || findProduct.qty,
  //       maxGty: maxGty || findProduct.maxGty,
  //       ProductStock: ProductStock || findProduct.ProductStock,
  //       ProductDesc: ProductDesc || findProduct.ProductDesc,
  //       ProductGst: ProductGst || findProduct.ProductGst,
  //       activeStatus: activeStatus || findProduct.activeStatus,
  //       Material: Material || findProduct.Material,
  //       ProductSize: ProductSize || findProduct.ProductSize,
  //       Color: Color || findProduct.Color,
  //       seater: seater || findProduct.seater,
  //       ProductIcon: uploadedFiles.ProductIcon || findProduct.ProductIcon,
  //       ProductImg1: uploadedFiles.ProductImg1 || findProduct.ProductImg1,
  //       ProductImg2: uploadedFiles.ProductImg2 || findProduct.ProductImg2,
  //       ProductImg3: uploadedFiles.ProductImg3 || findProduct.ProductImg3,
  //     };

  //     // Update product in the database
  //     const updatedProduct = await ProductManagementModel.findByIdAndUpdate(
  //       ProductId,
  //       { $set: updatedFields },
  //       { new: true }
  //     );
  //     console.log(updatedProduct)
  //     return res.json({
  //       message: "Product updated successfully",
  //       data: updatedProduct,
  //     });

  //   } catch (error) {
  //     console.error("Error updating product:", error);
  //     return res.status(500).json({ error: "Unable to update the product" });
  //   }
  // }

  async updateProducts(req, res) {
    try {
      const ProductId = req.params.id;
      const {
        ProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        repairCount,
        offerPrice,
        qty,
        ProductStock,
        Material,
        ProductSize,
        Color,
        seater,
      } = req.body;

      // Find the existing product
      const findProduct = await ProductManagementModel.findById(ProductId);
      if (!findProduct) {
        return res.status(404).json({ error: "No such record found" });
      }
      // basic idea: total is alaways "productstock + repair"
      let newProductStock = findProduct.ProductStock;
      let newRepair = findProduct.repair || 0;

      if (ProductStock !== undefined && repair !== undefined) {
        newProductStock = ProductStock - repair; // Update new productStock
        newRepair = repair;
      }
      // If only ProductStock is provided
      else if (ProductStock !== undefined) {
        newProductStock = ProductStock - (findProduct.repair || 0);
      }
      // If only repair count is provided
      else if (repair !== undefined) {
        newProductStock = findProduct.ProductStock - repair;
        newRepair = repair;
      }


      // ✅ Handle single image update
      const updatedFields = {
        ProductName: ProductName ?? findProduct.ProductName,
        ProductCategory: ProductCategory ?? findProduct.ProductCategory,
        ProductSubcategory:
          ProductSubcategory ?? findProduct.ProductSubcategory,
        ProductFeature: ProductFeature ?? findProduct.ProductFeature,
        ProductPrice: ProductPrice ?? findProduct.ProductPrice,
        offerPrice: offerPrice ?? findProduct.offerPrice,
        qty: qty ?? findProduct.qty,
        ProductStock: newProductStock,
        repair: newRepair,
        ProductDesc: ProductDesc ?? findProduct.ProductDesc,
        Material: Material ?? findProduct.Material,
        ProductSize: ProductSize ?? findProduct.ProductSize,
        Color: Color ?? findProduct.Color,
        seater: seater ?? findProduct.seater,

        // ✅ Keep the old image if no new image is uploaded
        // Cloudinary: req.file.path = secure_url.
        ProductIcon: req.file ? req.file.path : findProduct.ProductIcon,
      };

      Object.keys(updatedFields).forEach(
        (key) => updatedFields[key] === undefined && delete updatedFields[key]
      );

      // ✅ Update product in the database
      const updatedProduct = await ProductManagementModel.findByIdAndUpdate(
        ProductId,
        { $set: updatedFields },
        { new: true }
      );

      return res.json({
        message: "Product updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      return res.status(500).json({ error: "Unable to update the product" });
    }
  }

  async FindwithProductID(req, res) {
    try {
      const id = req.params.id;

      if (!id) {
        return res.status(400).json({ error: "ID parameter is missing" });
      }

      let Productdetail = await ProductManagementModel.findById(id);

      if (Productdetail) {
        return res.json({ Productdetails: Productdetail });
      } else {
        return res.status(404).json({ message: "Product detail not found" });
      }
    } catch (error) {
      console.error("Error in getProductdetails:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async getProductByCategory(req, res) {
    try {
      let { ProductCategory } = req.body;

      let data = await ProductManagementModel.find({ ProductCategory }).sort({
        _id: -1,
      });

      if (data.length > 0) {
        return res.status(200).json({ ProductData: data });
      } else {
        return res.status(400).send("No Data Found");
      }
    } catch (error) {
      console.log(error, "Error in Product Management Controller");
      return res.status(500).json({ error: "Something went wrong" });
    }
  }

  async activeStatusenble(req, res) {
    let ProductId = req.params.id;
    let { activeStatus } = req.body;
    try {
      const updatedCall = await ProductManagementModel.findByIdAndUpdate(
        ProductId,
        { $set: { activeStatus: activeStatus } },
        { new: true }
      );

      if (!updatedCall) {
        return res.status(404).json({ error: "Product  not found." });
      }

      res.status(200).json(updatedCall);
    } catch (error) {
      res.status(500).json({ error: "Error updating the Product data." });
    }
  }

  async getProductManagement(req, res) {
    try {
      let Product = await ProductManagementModel.find({}).sort({ _id: -1 });
      if (Product) {
        return res.status(200).json({ Product: Product });
      } else {
        return res.status(404).json({ message: "No Products found." });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Internal server error.", error: error.message });
    }
  }

  async getProductById(req, res) {
    console.log(`getprodutcbyid `,);
    const { id } = req.params;

    try {
      // Check if ID is valid
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID format." });
      }

      const product = await ProductManagementModel.findById(id);

      if (product) {
        console.log("Product found:", product);
        return res.status(200).json({ product });
      } else {
        return res.status(404).json({ message: "Product not found." });
      }

    } catch (error) {
      console.error("Error in getProductById:", error);
      return res.status(500).json({
        message: "Internal server error.",
        error: error.message,
      });
    }
  }

  async getProductforInventory(req, res) {
    try {
      let Product = await ProductManagementModel.find({})
        .sort({ _id: -1 })
        .select("ProductName Dates ProductStock ProductIcon");
      if (Product) {
        return res.status(200).json({ Product: Product });
      } else {
        return res.status(404).json({ message: "No Products found." });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Internal server error.", error: error.message });
    }
  }

  async quoteProduct(req, res) {
    try {
      let Product = await ProductManagementModel.find({});
      // .select(
      //   "ProductName ProductPrice offerPrice ProductSKU"
      // );

      if (Product) {
        return res.status(200).json({ QuoteProduct: Product });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Internal server error.", error: error.message });
    }
  }

  async getaggregetinventory(req, res) {
    try {
      const hit = listCache.get(listCache.KEYS.products);
      if (hit) return res.status(200).json({ ProductsData: hit });

      const withLiveStock = await buildProductList();
      listCache.set(listCache.KEYS.products, withLiveStock);
      return res.status(200).json({ ProductsData: withLiveStock });
    } catch (error) {
      console.log("getaggregetinventory error:", error);
      return res.status(500).json({ error: "Failed to retrieve data" });
    }
  }

  async getTotalNumberOfProduct(req, res) {
    try {
      let productCount = await ProductManagementModel.countDocuments({});

      if (productCount !== null) {
        return res.json({ productCount: productCount });
      } else {
        return res.status(404).json({ error: "No product found" });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve product count" });
    }
  }

  async postsubcategory(req, res) {
    let { ProductSubcategory } = req.body;

    let data = await ProductManagementModel.find({ ProductSubcategory });

    if (data) {
      return res.json({ productData: data });
    }
  }

  async postdeleteProductManagement(req, res) {
    let id = req.params.id;
    const data = await ProductManagementModel.deleteOne({ _id: id });

    return res.json({ success: "Successfully" });
  }

  async getProductsWithInventory(req, res) {
    try {
      // Fetch all products
      const products = await ProductManagementModel.find();

      // Fetch all inventory data
      const inventoryData = await InventoryModel.find();

      // Create a map of product IDs to product names for quick lookup
      const productMap = products.reduce((map, product) => {
        map[product._id.toString()] = product.ProductName; // Map product ID to ProductName
        return map;
      }, {});

      // Enrich inventory data with product names
      const enrichedInventoryData = inventoryData.map((inventory) => ({
        ...inventory.toObject(),
        productName: productMap[inventory.productId] || "Unknown Product", // Attach product name
      }));

      // Map inventory data to products
      const productsWithInventory = products.map((product) => {
        // Find inventory related to this product
        const relatedInventory = enrichedInventoryData.filter(
          (inventory) => inventory.productId === product._id.toString()
        );

        // Select the first availableQty from inventory or default to 0
        const availableQty =
          relatedInventory.length > 0 ? relatedInventory[0].availableQty : 0;

        // Attach inventory details to the product
        return {
          ...product.toObject(), // Convert Mongoose document to plain object
          inventory: relatedInventory,
          availableQty, // Attach the first availableQty value
        };
      });

      // Respond with the products and their inventory
      res.status(200).json({
        success: true,
        data: productsWithInventory,
      });
    } catch (error) {
      console.error("Error fetching products with inventory:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch products with inventory data.",
      });
    }
  }

  // ── NEW: Add multiple color images to an existing product via Cloudinary ────
  // POST /api/product/addProductImages/:id
  // multipart/form-data fields:
  //   productImages  — files (handled by multer-cloudinary)
  //   colors         — JSON string array matching file order e.g. '["Red","Blue"]'
  async addProductImages(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const product = await ProductManagementModel.findById(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      // colors is sent as a JSON string array: '["Red","","Blue"]'
      let colors = [];
      try {
        colors = req.body.colors ? JSON.parse(req.body.colors) : [];
      } catch {
        colors = [];
      }

      const newImages = files.map((file, idx) => ({
        url: file.path,           // Cloudinary secure_url
        public_id: file.filename, // Cloudinary public_id
        color: colors[idx] || "",
      }));

      const updated = await ProductManagementModel.findByIdAndUpdate(
        id,
        { $push: { images: { $each: newImages } } },
        { new: true }
      );

      return res.status(200).json({
        message: "Images added successfully",
        images: updated.images,
      });
    } catch (error) {
      console.error("addProductImages error:", error);
      return res.status(500).json({ error: "Failed to add images" });
    }
  }

  // ── NEW: Delete a single image from a product's images array ────────────────
  // DELETE /api/product/deleteProductImage/:id
  // Body: { public_id: "rentangadi/products/images/abc123" }
  async deleteProductImage(req, res) {
    try {
      const { id } = req.params;
      const { public_id } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
      if (!public_id) {
        return res.status(400).json({ error: "public_id is required" });
      }

      // Delete from Cloudinary
      await cloudinary.uploader.destroy(public_id);

      // Remove from product's images array
      const updated = await ProductManagementModel.findByIdAndUpdate(
        id,
        { $pull: { images: { public_id } } },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }

      return res.status(200).json({
        message: "Image deleted successfully",
        images: updated.images,
      });
    } catch (error) {
      console.error("deleteProductImage error:", error);
      return res.status(500).json({ error: "Failed to delete image" });
    }
  }

  // bulkupload
  async addServicesViaExcel(req, res) {
    const productData = req.body;

    // Ensure we receive an array of services
    if (!Array.isArray(productData) || productData.length === 0) {
      return res
        .status(400)
        .json({ error: "No data provided or invalid format" });
    }
    try {
      const productList = await ProductManagementModel.insertMany(productData);
      if (productList.length > 0) {
        return res.status(200).json({ success: "Product Added", productList });
      } else {
        return res.status(400).json({ error: "Failed to add product" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

const ProductManagemntController = new ProductManagement();
module.exports = ProductManagemntController;
module.exports.buildProductList = buildProductList;
