const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");

/* Reserving or releasing stock changes every product's StockAvailable, so
   the cached product list is dropped on any change made here. */
router.use(listCache.invalidateOn(listCache.KEYS.products));
const inventoryController = require("../controller/inventory");

router.post("/createinventory", inventoryController.updateInventory);
router.get('/check-availability/:date', inventoryController.getInventoryByDate);
router.get("/filter", inventoryController.getInventoryByDateSlotProducts);
router.post("/product/filter/:id", inventoryController.getAvailableStockByProductId);
router.post("/get-by-slot-and-date", inventoryController.getinventorydataprroduct)



module.exports = router;
