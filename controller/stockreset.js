const cron = require('node-cron');
const InventoryModel = require('../model/inventory');
const ProductManagementModel = require('../model/product')

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const today = new Date();
    const expiredInventories = await InventoryModel.find({ endDate: { $lt: today } });

    for (const inventory of expiredInventories) {
      const dbProduct = await ProductManagementModel.findById(inventory.productId);
      if (dbProduct) {
        dbProduct.ProductStock += inventory.reservedQty;
        await dbProduct.save();
      }

      // Delete expired inventory entry
      await InventoryModel.findByIdAndDelete(inventory._id);
    }

    console.log("Stock reset completed.");
  } catch (error) {
    console.error("Error resetting stock:", error);
  }
});
