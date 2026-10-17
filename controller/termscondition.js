const TermsandConditionModel = require("../model/termscondition");

class TermsandCondition {
  async createTermsandCondition(req, res) {
    let { category, points, desc, header } = req.body;
    console.log(category, points, ">>>>>>>>>")
    let add = new TermsandConditionModel({
      category,
      points,
      desc,
      header,
    });

    try {
      let save = await add.save();
      if (save) {
        return res.json({ success: "TermsandCondition created successfully" });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to create TermsandCondition" });
    }
  }

  async findwityhcategory(req, res) {
    let { category } = req.body;

    try {
      const TermsandConditionData = await TermsandConditionModel.find({
        category,
      });

      if (TermsandConditionData) {
        return res
          .status(200)
          .json({ TermsandConditionData: TermsandConditionData });
      }
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async allTermsandCondition(req, res) {
    try {
      const TermsandConditionData = await TermsandConditionModel.find({});

      if (TermsandConditionData) {
        return res
          .status(200)
          .json({ TermsandConditionData: TermsandConditionData });
      }
    } catch (error) {
      console.error("Something went wrong", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async postdeletetermsandcondition(req, res) {
    let id = req.params.id;
    try {
      const data = await TermsandConditionModel.deleteOne({ _id: id });

      return res.json({ success: "Successfully deleted" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete " });
    }
  }
}

const TermsandConditionController = new TermsandCondition();
module.exports = TermsandConditionController;
