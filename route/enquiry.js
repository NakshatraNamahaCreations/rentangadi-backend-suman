const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");

/* Any non-GET on this router may have changed the collection, so the
   cached list is dropped. Hooking the router rather than each handler
   means new routes are covered without touching this again. */
router.use(listCache.invalidateOn(listCache.KEYS.enquiries));
const EnquiryController = require("../controller/enquiry");
const { userMiddleware, clientMiddleware } = require("../middleware/clientMiddleware");

router.post("/createEnquiry", EnquiryController.createEnquiry);
router.get(
  "/TotalNumberOfEnquiry",
  EnquiryController.getTotalAndTodayEnquiryCount
);
router.get("/getallEnquiry", EnquiryController.allEnquiry);
router.get("/enquiry-details/:id", EnquiryController.getEnquiryById);
router.get("/related", EnquiryController.getRelatedEnquiriesByQuotationId); // by sonali
router.post("/updatefollowup/:id", EnquiryController.updateenquiryfollowup);
router.get("/my-enquiries/:id", EnquiryController.getMyEnquiries);
router.put("/update-enquiry/:id", EnquiryController.updateEnquiry); // by sonali
router.delete("/deleteEnquiry/:id", EnquiryController.postdeleteEnquiry);
router.get("/getEnquiryaggbyid/:id", EnquiryController.getEnquiryaggredata);
router.post("/add-products", EnquiryController.addProductsToEnquiry);
router.put('/updateenquiries/:id', EnquiryController.updateEnquiries);
router.put('/update-product-data/:id', EnquiryController.updateProductData);
router.delete('/delete-product-data/:id', EnquiryController.deleteProductFromEnquiry);
router.put('/add/:id', EnquiryController.addProductToEnquiry);

module.exports = router;



