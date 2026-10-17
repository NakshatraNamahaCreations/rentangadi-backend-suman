const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");

/* Any non-GET on this router may have changed the collection, so the
   cached list is dropped. Hooking the router rather than each handler
   means new routes are covered without touching this again. */
router.use(listCache.invalidateOn(listCache.KEYS.orders));
/* Reserving or releasing stock changes every product's StockAvailable. */
router.use(listCache.invalidateOn(listCache.KEYS.products));
const orderController = require("../controller/order");
const { userMiddleware } = require("../middleware/clientMiddleware");

router.post("/postaddorder", orderController.postaddorder);
router.get("/getallorder", orderController.getallorders);
router.get("/my-orders/:id", orderController.getMyOrders);
router.get("/my-orders-token", userMiddleware, orderController.getMyOrdersToken);
router.get("/getOrder/:id", orderController.getOrderById);
router.get("/getApprovedData", orderController.getApprovedOrders);
router.get("/TotalNumberOfOrder", orderController.getTotalNumberOfOrder);
router.get("/findwithclientid/:id", orderController.getfindwithClientID);
router.put("/updateOrderById/:id", orderController.updateOrderById);
router.put("/reorder-products/:id", orderController.reorderSlotProducts);
router.put("/updateExistingOrderById/:id", orderController.updateExistingOrderById);
router.put("/addNewProductToOrderById/:id", orderController.addNewProductToOrderById);
router.put("/updateOrderFields", orderController.updateOrderFields);
router.delete("/deleteProductInOrderById/:id", orderController.deleteProductInOrderById);
router.put("/updateStatus/:id", orderController.updateStatus);
router.put("/refurbishment/:id", orderController.refurbishment);
router.put("/updateRemarks", orderController.updateRemarks);

router.get(
  "/products/sales/highest-lowest",
  orderController.getHighestAndLowestProductSales
);
router.get("/category/sales/highest-lowest", orderController.getCategorySales);
router.get(
  "/products/sales/highest-lowest/date",
  orderController.getHighestAndLowestProductSalesdate
);
router.get(
  "/products/sales/individual/:productId",
  orderController.getProductSalesData
);

// order
router.post("/cancel-slot", orderController.cancelOrder);

router.get("/invoice", orderController.invoiceId)

module.exports = router;
