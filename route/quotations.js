const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");

/* Any non-GET on this router may have changed the collection, so the
   cached list is dropped. Hooking the router rather than each handler
   means new routes are covered without touching this again. */
router.use(listCache.invalidateOn(listCache.KEYS.quotations));
/* Reserving or releasing stock changes every product's StockAvailable. */
router.use(listCache.invalidateOn(listCache.KEYS.products));
const QuotationsController = require("../controller/quotations");

router.post("/createQuotation", QuotationsController.createQuotations);
router.get(
  "/TotalNumberOfquotation",
  QuotationsController.getTotalAndTodayQuotationCount
);
router.get("/getallquotations", QuotationsController.allquotations);
router.get("/my-quotations/:userId", QuotationsController.getMyQuotations);
router.get("/getquotation/:quotationId", QuotationsController.getQuotationById);
router.post("/updatefollowup/:id", QuotationsController.updatequotefollowup);
router.delete("/deletequotation/:id", QuotationsController.postdeletequotation);
router.get(
  "/getquotationaggbyid/:id",
  QuotationsController.getquotationaggredata
);
router.put('/updateQuotationOnOrder/:id', QuotationsController.updateQuotationOnOrder);
router.put('/updateQuotation', QuotationsController.updateQuotation);
router.post("/add-products", QuotationsController.addProductsToSlots);
router.post('/addontherproductsameslots', QuotationsController.addOntherProductsToSlots);
router.put('/updateQuotationquantity', QuotationsController.updateQuotation1);
router.post('/addontherproductsameslotstwo', QuotationsController.addOntherProductsToSlotstwo);
router.post('/addontherproductstoSlotsquotation', QuotationsController.addOntherProductsToSlotsQuotation);
router.post("/cancel/:id", QuotationsController.cancelQuotation);

router.put("/update-quotation/:quotationId", QuotationsController.updateQuotationById);
router.put("/reorder-products/:quotationId", QuotationsController.reorderSlotProducts);


module.exports = router;
