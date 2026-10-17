const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const path = require("path");


mongoose
  .connect(process.env.MONGO_URI, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() =>
    console.log("=============MongoDb Database connected successfuly")
  )
  .catch((err) => console.log("Database Not connected !!!", err));

//middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({ maxAge: 86400 }));
app.use(morgan("dev"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const payu = require("./route/payu");
const category = require("./route/category");
const subcategory = require("./route/subcategory");
const product = require("./route/product");
const Clients = require("./route/clients");
const banner = require("./route/banner");
const order = require("./route/order");
const quotations = require("./route/quotations");
const termscondition = require("./route/termscondition");
const refurbishment = require("./route/refurbishment");
const inventory = require("./route/inventory");
const CCAvenue = require("./route/CCAvenue");
const enquiry = require("./route/enquiry");
const adminLogin = require("./route/Auth/adminLogin");
const payment = require('./route/payment')
const report = require('./route/report')
const user = require("./route/user");
const clientAuth = require("./route/Auth/clientAuth.js");
const executive = require("./route/executive");

app.use("/api", payu);
app.use("/api", adminLogin);
app.use("/api/user", user);
app.use("/api/category", category);
app.use("/api/subcategory", subcategory);
app.use("/api/product", product);
app.use("/api/client", Clients);
// app.use("/api/clientAuth", clientAuth);
app.use("/api/executive", executive);
app.use("/api/banner", banner);
app.use("/api/order", order);
app.use("/api/quotations", quotations);
app.use("/api/termscondition", termscondition);
app.use("/api/refurbishment", refurbishment);
app.use("/api/inventory", inventory);
app.use("/api/payment", CCAvenue);
app.use("/api/Enquiry", enquiry);
app.use("/api/payment", payment);
app.use("/api/report", report);

/* The three big lists are read once on boot and refreshed in the
   background, so opening a screen serves them from memory instead of
   waiting four seconds on Atlas. */
const listCache = require("./utils/listCache");
const Enquirymodel = require("./model/enquiry");
const ordermodel = require("./model/order");
const Quotationmodel = require("./model/quotations");

listCache.register(listCache.KEYS.enquiries, () =>
  Enquirymodel.find({})
    .populate("executiveId", "name")
    .sort({ _id: -1 })
    .select(
      "enquiryId clientName clientNo enquiryDate enquiryTime executivename " +
        "executiveId GrandTotal status createdAt"
    )
    .lean()
);

listCache.register(listCache.KEYS.orders, () =>
  ordermodel
    .find({})
    .sort({ _id: -1 })
    .select(
      "orderId clientName clientNo executivename GrandTotal createdAt " +
        "Address orderStatus slots.slotName slots.quoteDate slots.endDate " +
        "slots.quoteTime"
    )
    .lean()
);

listCache.register(listCache.KEYS.quotations, () =>
  Quotationmodel.find({})
    .sort({ _id: -1 })
    .select(
      "quoteId clientName clientNo quoteDate quoteTime endDate " +
        "executivename GrandTotal GST status createdAt discount " +
        "inchargeName labourecharge transportcharge"
    )
    .lean()
);

const UserModel = require("./model/user"); // clients live in the user collection, role: "client"

listCache.register(listCache.KEYS.clients, () =>
  UserModel.find({ role: "client" })
    .populate({ path: "executives", select: "-password" })
    .select("-password")
    .sort({ createdAt: -1 })
    .lean()
);

/* The product list needs live stock figures recomputed from the inventory
   rows, so the refresh calls the builder the handler itself uses. */
const { buildProductList } = require("./controller/product");

listCache.register(listCache.KEYS.products, buildProductList);

mongoose.connection.once("open", () => listCache.start());

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to Rent Angadi Aug 06 2025 8:00pm " });
});

app.listen(PORT, () => {
  console.log("Server is running on", PORT);
});
