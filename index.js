const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const path = require("path");


/**
 * Database connection.
 *
 * The promise is kept so requests can wait on it instead of firing queries
 * at a connection that is not up yet. Without that, Mongoose buffers each
 * query for ten seconds and then fails with a generic timeout, which hides
 * the real reason - and on a 10s serverless platform that reads as a 500 on
 * every single call.
 */
let dbError = null;

const dbReady = mongoose
  .connect(process.env.MONGO_URI, {
    /* Fail in well under the 10s serverless limit, so the real error is
       returned instead of being cut off by the platform. */
    serverSelectionTimeoutMS: 7000,
  })
  .then(() => {
    console.log("=============MongoDb Database connected successfuly");
    dbError = null;
  })
  .catch((err) => {
    dbError = err;
    console.log("Database Not connected !!!", err);
  });

/* A missing or wrong MONGO_URI looks exactly like a network problem from the
   outside, so it is named explicitly at boot. */
if (!process.env.MONGO_URI) {
  console.log(
    "Database Not connected !!! MONGO_URI is not set in this environment"
  );
}

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

/**
 * Nothing under /api can work without the database, so every request waits
 * for the connection and gets a straight answer if it failed. This replaces
 * ten seconds of buffering followed by "Internal server error".
 */
app.use("/api", async (req, res, next) => {
  try {
    await dbReady;
  } catch (err) {
    dbError = err;
  }

  if (mongoose.connection.readyState === 1) return next();

  return res.status(503).json({
    error: "Database unavailable",
    reason: dbError
      ? dbError.message
      : !process.env.MONGO_URI
        ? "MONGO_URI is not set in this environment"
        : "Still connecting",
  });
});

/**
 * Says whether this deployment can reach the database, without exposing the
 * connection string. One request answers what would otherwise mean reading
 * the platform logs.
 */
app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const uri = process.env.MONGO_URI || "";
  res.json({
    ok: mongoose.connection.readyState === 1,
    database: states[mongoose.connection.readyState] || mongoose.connection.readyState,
    mongoUriPresent: Boolean(uri),
    mongoUriLength: uri.length,
    /* Host only - never the user, password or options. */
    mongoHost: (uri.match(/@([^/?]+)/) || [])[1] || null,
    lastError: dbError ? dbError.message : null,
    node: process.version,
  });
});

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
