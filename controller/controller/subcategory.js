const appsubcatModel = require("../model/subcategory");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

class appsubcat {
  async addappsubcat(req, res) {
    let { subcategory, category } = req.body;
    let file = req.file?.filename;

    let add = new appsubcatModel({
      subcategory,
      category,
      subcatimg: file,
    });

    try {
      let save = await add.save();
      if (save) {
        // Invalidate cache after adding a new subcategory
        cache.del("allAppSubcategories");
        return res.json({ success: "Subcategory added successfully" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to add subcategory" });
    }
  }

  async editappsubcat(req, res) {
    const subcategoryId = req.params.id;
    const { subcategory, category } = req.body;
    const file = req.file?.filename;
    try {
      const findCategory = await appsubcatModel.findOne({ _id: subcategoryId });
      if (!findCategory) {
        return res.json({ error: "No data found" });
      }

      findCategory.category = category || findCategory.category;

      findCategory.subcategory = subcategory || findCategory.subcategory;
      if (file) {
        findCategory.subcatimg = file;
      }

      let updatedData = await appsubcatModel.findOneAndUpdate(
        { _id: subcategoryId },
        findCategory,
        { new: true }
      );

      if (updatedData) {
        // Invalidate cache after updating a subcategory
        cache.del("allAppSubcategories");
        return res.json({ success: "Updated", data: updatedData });
      } else {
        return res.json({ error: "Update failed" });
      }
    } catch (error) {
      console.log("error", error);
      return res
        .status(500)
        .json({ error: "Unable to update the subcategory" });
    }
  }

  async getappsubcat(req, res) {
    let cachedSubcategories = cache.get("allAppSubcategories");
    if (cachedSubcategories) {
      return res.json({ subcategory: cachedSubcategories });
    } else {
      try {
        let subcategory = await appsubcatModel.find({});
        if (subcategory) {
          cache.set("allAppSubcategories", subcategory);
          return res.json({ subcategory: subcategory });
        } else {
          return res.status(404).json({ error: "No subcategories found" });
        }
      } catch (error) {
        return res
          .status(500)
          .json({ error: "Failed to retrieve subcategories" });
      }
    }
  }

  async postappsubcat(req, res) {
    let { category } = req.body;
    console.log("category----", category);
    try {
      const subcategories = await appsubcatModel
        .find({ category })
        .select("subcategory _id");

      console.log("subcategories", subcategories);
      if (subcategories) {
        return res.json({ subcategories: subcategories });
      } else {
        return res
          .status(404)
          .json({ error: "No subcategories found for the specified category" });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve subcategories" });
    }
  }

  async deleteappsubcat(req, res) {
    let id = req.params.id;
    console.log("id---", id);
    try {
      let data = await appsubcatModel.deleteOne({ _id: id });
      if (data.deletedCount > 0) {
        // Invalidate cache after deleting a subcategory
        cache.del("allAppSubcategories");
        return res.json({ success: "Successfully deleted" });
      } else {
        return res.status(404).json({ error: "Subcategory not found" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete subcategory" });
    }
  }
}

const appsubcatcontroller = new appsubcat();
module.exports = appsubcatcontroller;
