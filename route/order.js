const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");
/* Deleting a whole record asks for the admin password first. */
const confirmPassword = require("../middleware/confirmPassword");

/* Any non-GET on this router may have changed the collection, so the
   cached list is dropped. Hooking the router rather than each handler
   means new routes are covered without touching this again. */
router.use(listCache.invalidateOn(listCache.KEYS.orders));
/* Raising an order marks its quotation as sent, and cancelling one leaves
   that quotation reading differently too - so the quotation list is as
   stale as the order list after a write here. Without this the quotation
   list kept saying Pending for up to two minutes after Generate Order. */
router.use(listCache.invalidateOn(listCache.KEYS.quotations));
/* And the enquiry behind that quotation moves from "quotation sent" to
   "confirmed", or back to "cancelled". The enquiry list now carries that
   stage, so it goes stale here too - without this the enquiry list and
   calendar kept saying Quotation Sent for up to two minutes after an order
   was raised. */
router.use(listCache.invalidateOn(listCache.KEYS.enquiries));
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
/* Deleting the whole order, which asks for the admin password first. The
   per-product delete above does not: it is an edit to an order that stays. */
router.delete("/deleteOrder/:id", confirmPassword, orderController.deleteOrderById);
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
