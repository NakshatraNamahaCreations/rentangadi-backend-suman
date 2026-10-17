const express = require("express");
const router = express.Router();

const listCache = require("../utils/listCache");

/* Any non-GET here may have changed a product, so the cached list is
   dropped once the response is on its way. */
router.use(listCache.invalidateOn(listCache.KEYS.products));
const ProductManagemntController = require("../controller/product");

const multer = require("multer");

// ── Local-disk storage kept for backward compat (currently unused) ───────────
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/product");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// ── Cloudinary storage (main product image + color-images feature) ───────────
const { uploadProductImages, uploadProductMain } = require("../config/cloudinary");

router.post(
  "/addProducts",
  uploadProductMain.any(""),
  ProductManagemntController.addProductManagement
);
router.get("/getProducts", ProductManagemntController.getProductManagement);
router.get("/product-details/:id", ProductManagemntController.getProductById);
router.get(
  "/getProductsInventory",
  ProductManagemntController.getProductforInventory
);
// router.put(
//   "/editProducts/:id",
//   ProductManagemntController.editProductManagement
// );
router.put(
  "/editProducts/:id",
  uploadProductMain.any(), // Make sure this is present!
  ProductManagemntController.editProductManagement
);

router.get("/damaged-products", ProductManagemntController.getDamagedProducts);
router.post("/damaged-products", ProductManagemntController.editDamagedProductManagement);

router.delete(
  "/deleteProducts/:id",
  ProductManagemntController.postdeleteProductManagement
);
router.post("/postsubcatProduct", ProductManagemntController.postsubcategory);

// 27-09
router.post(
  "/getProductbycategory",
  ProductManagemntController.getProductByCategory
);
router.get(
  "/TotalNumberOfProduct",
  ProductManagemntController.getTotalNumberOfProduct
);

router.put(
  "/updateProducts/:id",
  uploadProductMain.single("ProductIcon"),
  ProductManagemntController.updateProducts
);

router.post(
  "/updateenabledisble/:id",
  ProductManagemntController.activeStatusenble
);

router.get("/quoteproducts", ProductManagemntController.quoteProduct);
router.get(
  "/getinventoryproducts",
  ProductManagemntController.getaggregetinventory
);

router.get("/products-with-inventory", ProductManagemntController.getProductsWithInventory);
router.post("/bulkuploadproduct", ProductManagemntController.addServicesViaExcel)

router.post(
  "/addProductImages/:id",
  uploadProductImages.array("productImages", 20),
  ProductManagemntController.addProductImages
);
router.delete(
  "/deleteProductImage/:id",
  ProductManagemntController.deleteProductImage
);


module.exports = router;
