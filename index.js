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

/**
 * Mongoose only reconnects by itself once a first connection has been made.
 * If this one fails - a slow DNS answer or a moment with no primary is
 * enough - it never tries again, and the process then answers every request
 * with "Database unavailable" until someone notices and restarts it. So the
 * first connection is retried, backing off to half a minute.
 */
const connect = () =>
  mongoose.connect(process.env.MONGO_URI, {
    /* Fail in well under the 10s serverless limit, so the real error is
       returned instead of being cut off by the platform. */
    serverSelectionTimeoutMS: 7000,
  });

const connectWithRetry = async (attempt = 1) => {
  try {
    /* A failed attempt leaves a topology still retrying underneath, and a
       second connect() on top of that one never settles - so it is dropped
       before trying again. */
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    await connect();
    dbError = null;
    console.log("=============MongoDb Database connected successfuly");
  } catch (err) {
    dbError = err;
    const wait = Math.min(30000, attempt * 3000);
    console.log(
      `Database Not connected !!! retrying in ${wait / 1000}s`,
      err.message
    );
    setTimeout(() => connectWithRetry(attempt + 1), wait).unref?.();
  }
};

/* Settles when the first attempt has been made, not when it succeeded: a
   request arriving during an outage gets the 503 below rather than hanging
   on a connection that may be minutes away. */
const dbReady = connectWithRetry();

/* A missing or wrong MONGO_URI looks exactly like a network problem from the
   outside, so it is named explicitly at boot. */
if (!process.env.MONGO_URI) {
  console.log(
    "Database Not connected !!! MONGO_URI is not set in this environment"
  );
}

/**
 * Which sites a browser may call this API from.
 *
 * This is not a security control and should not be mistaken for one - curl
 * and every other non-browser client ignore it completely, which is exactly
 * how the open endpoints were found. What it does do is stop a page on some
 * other domain from making a logged-in staff browser fetch on its behalf.
 * The token guard below is what actually protects the data.
 *
 * CORS_ORIGINS overrides the list, comma separated, so a new subdomain needs
 * an environment change rather than a deploy.
 */
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ||
  [
    "https://newadmin.rentangadi.in",
    "https://admin.rentangadi.in",
    "https://website.rentangadi.in",
    "https://client.rentangadi.in",
    "https://rentangadi.in",
    "https://www.rentangadi.in",
    /* The dev servers for the admin panel, the website and the exec panel. */
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
  ].join(",")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

//middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(
  cors({
    /* An unknown origin is answered without the CORS headers rather than
       with an error: throwing here turns a cross-origin page's fetch into a
       500 in our logs, and the browser blocks it either way. Requests with no
       Origin at all - curl, uptime checks, the payment gateways - are let
       through, because CORS has nothing to say about them. */
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    /* A browser hides every response header a cross-origin page did not ask
       for, so the paging counts would be invisible to the very callers they
       are for. */
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit"],
    maxAge: 86400,
  })
);
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

/**
 * Logging in is rate limited; everything that is not explicitly public needs
 * a token. Both sit here, above the route mounts, so a route added below is
 * covered without anyone having to remember to cover it.
 */
const loginLimit = require("./middleware/loginLimit");
const { gate } = require("./middleware/requireAuth");

const LOGIN_PATHS =
  /^\/(adminLogin|user\/(login|signup|executiveLogin)|client\/clientlogin)$/i;

app.use("/api", (req, res, next) => {
  const path = req.path.replace(/\/+$/, "") || "/";
  if (req.method !== "POST" || !LOGIN_PATHS.test(path)) return next();
  return loginLimit(req, res, next);
});

app.use("/api", gate);

/**
 * The two summary endpoints hold their own short-lived answers. A write
 * anywhere under /api may have changed what they say - a new order moves a
 * count, a client's totals and the dashboard all at once - so both are
 * dropped on any write rather than each route having to know about them.
 */
const dashboardCache = require("./controller/dashboard");
const clientActivityCache = require("./controller/clientActivity");

app.use("/api", (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    dashboardCache.invalidate();
    clientActivityCache.invalidate();
  });
  next();
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
app.use("/api/dashboard", require("./route/dashboard"));

/* The three big lists are read once on boot and refreshed in the
   background, so opening a screen serves them from memory instead of
   waiting four seconds on Atlas. */
const listCache = require("./utils/listCache");
const Enquirymodel = require("./model/enquiry");
const ordermodel = require("./model/order");
const Quotationmodel = require("./model/quotations");

/* The same fields the handlers send, from the same place. Written out
   again here, these drifted: the refresh dropped the keys that link a
   quotation to its enquiry and an order to its quotation, so two minutes
   after boot every list quietly lost them again. */
const listFields = require("./utils/listFields");

/* The stage - pending, quotation sent, confirmed, cancelled - is worked out
   here and cached with the rows, so the enquiry screens get it with the list
   instead of downloading every quotation and every order to derive it. */
const { withStage } = require("./utils/enquiryStage");

listCache.register(listCache.KEYS.enquiries, async () =>
  withStage(
    await Enquirymodel.find({})
      .populate("executiveId", "name")
      .sort({ _id: -1 })
      .select(listFields.ENQUIRIES)
      .lean()
  )
);

listCache.register(listCache.KEYS.orders, () =>
  ordermodel.find({}).sort({ _id: -1 }).select(listFields.ORDERS).lean()
);

/* Each quotation carries what became of the order raised from it, so the
   quotation screens do not download every order to find out. */
const { withOrderState } = require("./utils/quotationStage");

listCache.register(listCache.KEYS.quotations, async () =>
  withOrderState(
    await Quotationmodel.find({})
      .sort({ _id: -1 })
      .select(listFields.QUOTATIONS)
      .lean()
  )
);

const UserModel = require("./model/user"); // clients live in the user collection, role: "client"

listCache.register(listCache.KEYS.clients, () =>
  UserModel.find({ role: "client" })
    .populate({ path: "executives", select: listFields.CLIENT_EXECUTIVES })
    .select(listFields.CLIENTS)
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
