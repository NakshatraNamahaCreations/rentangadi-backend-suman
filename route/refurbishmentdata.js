const express = require("express");
const router = express.Router();
const refurbishmentController = require("../controller/refurbishmentdata");

router.post("/create", refurbishmentController.createRefurbishment);
router.get("/all", refurbishmentController.getAllRefurbishments);
router.get("/:id", refurbishmentController.getRefurbishmentById);
router.put("/:id", refurbishmentController.updateRefurbishment);
router.delete("/:id", refurbishmentController.deleteRefurbishment);

module.exports = router;
