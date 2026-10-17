const express = require("express");
const router = express.Router();
const refurbishmentController = require("../controller/refurbishment");
const refurbishmentControllers = require("../controller/refurbishmentdata");

router.post("/create", refurbishmentControllers.createRefurbishment);
router.get("/all", refurbishmentControllers.getAllRefurbishments);
router.get("/:id", refurbishmentControllers.getRefurbishmentById);
router.put("/:id", refurbishmentControllers.updateRefurbishment);
router.delete("/:id", refurbishmentControllers.deleteRefurbishment);

router.post(
  "/addRefurbishment",

  refurbishmentController.CreateRefurbishment
);
router.get("/getRefurbishment", refurbishmentController.getRefurbishment);

router.post(
  "/deleteRefurbishment/:id",
  refurbishmentController.postdeleteRefurbishment
);
router.put(
  "/editRefurbishment/:id",

  refurbishmentController.postdeleteRefurbishment
);

module.exports = router;
