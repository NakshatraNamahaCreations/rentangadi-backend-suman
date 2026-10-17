const express = require("express");
const router = express.Router();
const appsubcatcontroller = require("../controller/subcategory");

// Cloudinary storage for subcategory images
const { uploadSubcategory } = require("../config/cloudinary");

router.post(
  "/addappsubcat",
  uploadSubcategory.single("subcatimg"),
  appsubcatcontroller.addappsubcat
);
router.get("/getappsubcat", appsubcatcontroller.getappsubcat);
router.post("/postappsubcat", appsubcatcontroller.postappsubcat);
router.delete("/deleteappsubcat/:id", appsubcatcontroller.deleteappsubcat);
router.put(
  "/editappsubcat/:id",
  uploadSubcategory.single("subcatimg"),
  appsubcatcontroller.editappsubcat
);

module.exports = router;
