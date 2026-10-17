const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const puppeteer = require("puppeteer");

mongoose
  .connect("mongodb+srv://rentangadi:rentangadi@cluster0.uycn7mi.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    console.log("=============MongoDb Database connected successfuly")
  )
  .catch((err) => console.log("Database Not connected !!!", err));

//middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());
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

app.use("/api", payu);
app.use("/api", adminLogin);
app.use("/api/category", category);
app.use("/api/subcategory", subcategory);
app.use("/api/product", product);
app.use("/api/client", Clients);
app.use("/api/banner", banner);
app.use("/api/order", order);
app.use("/api/quotations", quotations);
app.use("/api/termscondition", termscondition);
app.use("/api/refurbishment", refurbishment);
app.use("/api/inventory", inventory);
app.use("/api/payment", CCAvenue);
app.use("/api/Enquiry", enquiry);
app.use("/api/payment", payment);

const PORT = process.env.PORTBACKUP || 7000;
app.listen(PORT, () => {
  console.log("Server is running on", PORT);
});
