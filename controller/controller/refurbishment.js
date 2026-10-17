const Refurbishmentmodel = require("../model/refurbishment");

class Refurbishment {
  async CreateRefurbishment(req, res) {
    let { productName, productSKU, comment, expense, date } = req.body;
    let add = new Refurbishmentmodel({
      productName,
      productSKU,
      comment,
      expense,
      date,
    });
    try {
      let save = await add.save();
      if (save) {
        return res.json({ success: "Added successfully" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to create" });
    }
  }
  async getRefurbishment(req, res) {
    try {
      let Refurbishment = await Refurbishmentmodel.find({}).sort({ _id: -1 });
      if (Refurbishment) {
        return res.json({ RefurbishmentData: Refurbishment });
      } else {
        return res.status(404).json({ error: "No categories found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to retrieve categories" });
    }
  }

  async updateRefurbishment(req, res) {
    try {
      let id = req.params.id;
      const { productName, productSKU, comment, expense } = req.body;

      const findRefurbishment = await Refurbishmentmodel.findOne({ _id: id });
      if (!findRefurbishment) {
        return res.json({ error: "No such record found" });
      }

      findRefurbishment.productName =
        productName || findRefurbishment.productName;
      findRefurbishment.productSKU = productSKU || findRefurbishment.productSKU;
      findRefurbishment.comment = comment || findRefurbishment.comment;
      findRefurbishment.expense = expense || findRefurbishment.expense;

      const updateRefurbishment = await Refurbishmentmodel.findOneAndUpdate(
        { _id: id },
        findRefurbishment,
        { new: true } // Return the updated document
      );

      return res.json({
        message: "Updated successfully",
        data: updateRefurbishment,
      });
    } catch (error) {
      console.log("error", error);
      return res
        .status(500)
        .json({ error: "Unable to update the Refurbishment" });
    }
  }

  async postdeleteRefurbishment(req, res) {
    let id = req.params.id;
    try {
      const data = await Refurbishmentmodel.deleteOne({ _id: id });
      if (data.deletedCount > 0) {
        return res.json({ success: "Successfully deleted" });
      } else {
        return res.status(404).json({ error: "Refurbishment not found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete Refurbishment" });
    }
  }
}

const refurbishmentController = new Refurbishment();
module.exports = refurbishmentController;
