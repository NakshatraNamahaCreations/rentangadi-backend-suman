const express = require("express");
const router = express.Router();
const TermsandConditionController = require("../controller/termscondition");

router.post(
  "/addtermscondition",
  TermsandConditionController.createTermsandCondition
);

router.get("/findwithcategory", TermsandConditionController.findwityhcategory);
router.get(
  "/allTermsandCondition",
  TermsandConditionController.allTermsandCondition
);
router.delete(
  "/deleteTC/:id",
  TermsandConditionController.postdeletetermsandcondition
);

module.exports = router;
