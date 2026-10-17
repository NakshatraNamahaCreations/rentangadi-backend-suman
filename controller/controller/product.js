const ProductManagementModel = require("../model/product");
const InventoryModel = require("../model/inventory");
const XLSX = require("xlsx");
const { default: mongoose } = require("mongoose");

const generateSKU = () => {
  const chars = "0123456789";
  let sku = "SKU";
  for (let i = 0; i < 3; i++) {
    // Generate 3 random digits
    sku += chars[Math.floor(Math.random() * chars.length)];
  }
  return sku;
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
      let file = req.files[0]?.filename;
      let file1 = req.files[1]?.filename;
      let file2 = req.files[2]?.filename;
      let file3 = req.files[3]?.filename;

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
      const newProductStock = qty - (repairCount ?? 0);
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

      let add = new ProductManagementModel({
        ProductName,
        ProductCategory,
        ProductSubcategory,
        ProductDesc,
        ProductFeature,
        ProductPrice,
        ProductGst,
        Productdetails,
        ProductStock: newProductStock,
        repairCount,
        StockAvailable: ProductStock,
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
    let file = req.files && req.files[0]?.filename;

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

      // basic idea: total is alaways "productstock + repair"
      let newProductStock
      let newRepairCount = Number(repairCount) ?? 0;

      newProductStock = qty - newRepairCount;


      // ✅ Handle single image update
      const updatedFields = {
        ProductName: ProductName ?? findProduct.ProductName,
        ProductCategory: ProductCategory ?? findProduct.ProductCategory,
        ProductSubcategory:
          ProductSubcategory ?? findProduct.ProductSubcategory,
        ProductFeature: ProductFeature ?? findProduct.ProductFeature,
        ProductPrice: ProductPrice ?? findProduct.ProductPrice,
        // offerPrice: offerPrice ?? findProduct.offerPrice,
        qty: qty ?? findProduct.qty,
        ProductStock: newProductStock,
        repairCount,
        ProductDesc: ProductDesc ?? findProduct.ProductDesc,
        Material: Material ?? findProduct.Material,
        ProductSize: ProductSize ?? findProduct.ProductSize,
        Color: Color ?? findProduct.Color,
        seater: seater ?? findProduct.seater,

        // ✅ Keep the old image if no new image is uploaded
        ProductIcon: req.file ? req.file.filename : findProduct.ProductIcon,
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

      let data = await ProductManagementModel.findOneAndUpdate(
        { _id: id },
        updateObj,
        { new: true }
      );

      if (data) {
        return res.json({ success: "Updated", Product: data });
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Data not found" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
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

      updatedProduct.ProductStock = Number(updatedProduct.qty) - (Number(updatedProduct.repairCount) + Number(updatedProduct.lostCount));

      const updatedProductStock = await ProductManagementModel.findByIdAndUpdate(
        { _id: productId },
        { ProductStock: updatedProduct.ProductStock },
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
        ProductIcon: req.file ? req.file.filename : findProduct.ProductIcon,
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
      let Data = await ProductManagementModel.aggregate([
        {
          $lookup: {
            from: "inventories",
            localField: "_id",
            foreignField: "productId",
            as: "inventory",
          },
        },
        {
          $addFields: {
            latestCreatedAt: { $ifNull: ["$createdAt", new Date(0)] },
          },
        },
        {
          $sort: { latestCreatedAt: -1 },
        },
      ]);
      if (Data) {
        return res.status(200).json({ ProductsData: Data });
      } else {
        return res.status(404).json({ error: "No data found" });
      }
    } catch (error) {
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
