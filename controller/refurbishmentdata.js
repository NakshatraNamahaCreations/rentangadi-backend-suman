const RefurbishmentData = require("../model/refurbishmentdata");
const mongoose = require("mongoose")

// Create a new refurbishment record with multiple products
exports.createRefurbishment = async (req, res) => {
  try {
    const { orderId, products, status } = req.body;

    // Validate required fields
    if (!products || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Ensure productId is converted to ObjectId
    const formattedProducts = products.map(product => ({
      productId: new mongoose.Types.ObjectId(product.productId),
      productName: product.productName,
      quantity: product.quantity,
      damage: product.damage || "",
      price: product.price,
    }));
    console.log("products: ", products)
    console.log("formatted products: ", formattedProducts)

    const newRefurbishment = new RefurbishmentData({
      products: formattedProducts,
      // shippingAddress,
      // floorManager,
      status, // Add status field
      orderId
    });
    console.log("newRefurb: ", newRefurbishment)

    let savedRefurbishment = await newRefurbishment.save();
    res.status(201).json({ message: "Refurbishment created successfully", savedRefurbishment });
  } catch (error) {
    console.error("Error creating refurbishment:", error);
    res.status(500).json({ message: "Error creating refurbishment", error: error.message });
  }
};

// Get all refurbishments
exports.getAllRefurbishments = async (req, res) => {
  try {
    const refurbishments = await RefurbishmentData.find().sort({ createdAt: -1 });
    res.status(200).json(refurbishments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching refurbishments", error });
  }
};

// Get a single refurbishment by ID
exports.getRefurbishmentById = async (req, res) => {
  const id = req.params.id;
  try {
    const refurbishment = await RefurbishmentData.findOne({ orderId: id });
    if (!refurbishment) return res.status(404).json({ message: "Refurbishment not found" });

    res.status(200).json(refurbishment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching refurbishment", error });
  }
};

// Update refurbishment details
exports.updateRefurbishment = async (req, res) => {
  try {
    const { status, notes, expense, floorManager, products } = req.body;
    const refurbishment = await RefurbishmentData.findById(req.params.id);

    if (!refurbishment) return res.status(404).json({ message: "Refurbishment not found" });

    refurbishment.status = status || refurbishment.status;
    refurbishment.notes = notes || refurbishment.notes;
    refurbishment.expense = expense || refurbishment.expense;
    refurbishment.floorManager = floorManager || refurbishment.floorManager;
    refurbishment.products = products || refurbishment.products;
    refurbishment.updatedAt = Date.now();

    await refurbishment.save();
    res.status(200).json({ message: "Refurbishment updated successfully", refurbishment });
  } catch (error) {
    res.status(500).json({ message: "Error updating refurbishment", error });
  }
};

// Delete a refurbishment record
exports.deleteRefurbishment = async (req, res) => {
  try {
    await RefurbishmentData.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Refurbishment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting refurbishment", error });
  }
};
