const NodeCache = require("node-cache");
const Ordermodel = require("../model/order");
const Quotationmodel = require("../model/quotations");
const Enquirymodel = require("../model/enquiry");
const Usermodel = require("../model/user");

/**
 * Everything the dashboard draws, in one answer.
 *
 * It used to make seven calls: three counters, and then the whole orders,
 * clients and quotations lists plus the whole enquiry list - about 1.7MB -
 * to show four numbers, a twelve-point sparkline each and two five-row
 * tables. Every one of those figures is a count or a top-five, which is work
 * the database does in milliseconds and a browser does by downloading
 * everything first.
 *
 * The counters it replaces (TotalNumberOfOrder and friends) are left in
 * place: the executive panel still calls them.
 */

/* Short on purpose. The dashboard is the first screen of a session and often
   left open; a minute old is close enough for a count, and it keeps a
   refreshed tab from re-running six aggregates. */
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
const KEY = "dashboard:summary";

const IST = "Asia/Kolkata";

/* Twelve months of counts for one collection, this calendar year, in the
   timezone the business works in - the browser was grouping by its own local
   time, so this keeps the same answer rather than shifting the boundaries. */
const monthlySeries = async (Model, year) => {
  const rows = await Model.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01T00:00:00+05:30`),
          $lt: new Date(`${year + 1}-01-01T00:00:00+05:30`),
        },
      },
    },
    {
      $group: {
        _id: { $month: { date: "$createdAt", timezone: IST } },
        n: { $sum: 1 },
      },
    },
  ]);

  const series = Array(12).fill(0);
  rows.forEach((r) => {
    /* $month is 1-12; the chart is indexed from 0. */
    series[r._id - 1] = r.n;
  });
  return series;
};

exports.summary = async (req, res) => {
  try {
    const hit = cache.get(KEY);
    if (hit) return res.status(200).json(hit);

    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00+05:30`);

    const [
      orderCount,
      quotationCount,
      clientCount,
      orderSeries,
      quotationSeries,
      clientSeries,
      recentOrders,
      recentEnquiries,
      statusRows,
    ] = await Promise.all([
      Ordermodel.estimatedDocumentCount(),
      Quotationmodel.estimatedDocumentCount(),
      /* Clients are a subset of the user collection, so this one has to be
         counted rather than estimated. */
      Usermodel.countDocuments({ role: "client" }),

      monthlySeries(Ordermodel, year),
      monthlySeries(Quotationmodel, year),
      /* Only clients, for the same reason. */
      Usermodel.aggregate([
        {
          $match: {
            role: "client",
            createdAt: {
              $gte: yearStart,
              $lt: new Date(`${year + 1}-01-01T00:00:00+05:30`),
            },
          },
        },
        { $group: { _id: { $month: { date: "$createdAt", timezone: IST } }, n: { $sum: 1 } } },
      ]).then((rows) => {
        const s = Array(12).fill(0);
        rows.forEach((r) => (s[r._id - 1] = r.n));
        return s;
      }),

      /* The five newest orders, with the item count worked out here rather
         than by sending every product on every order for the browser to
         count. */
      Ordermodel.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        {
          $project: {
            clientName: 1,
            GrandTotal: 1,
            orderStatus: 1,
            createdAt: 1,
            itemCount: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$slots", []] },
                  as: "slot",
                  in: { $size: { $ifNull: ["$$slot.products", []] } },
                },
              },
            },
          },
        },
      ]),

      Enquirymodel.find({}, "enquiryId clientName executivename status createdAt enquiryDate")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      /* This year's orders by status, for the breakdown panel. The labels are
         the frontend's to decide; this sends what is stored. */
      Ordermodel.aggregate([
        { $match: { createdAt: { $gte: yearStart } } },
        { $group: { _id: "$orderStatus", n: { $sum: 1 } } },
      ]),
    ]);

    const body = {
      counts: {
        Orders: orderCount,
        Quotations: quotationCount,
        Clients: clientCount,
      },
      series: {
        Orders: orderSeries,
        Quotations: quotationSeries,
        Clients: clientSeries,
      },
      recentOrders,
      recentEnquiries,
      /* { "Confirm": 1120, "cancelled": 127, ... } */
      orderStatusThisYear: Object.fromEntries(
        statusRows.map((r) => [String(r._id ?? ""), r.n])
      ),
      year,
    };

    cache.set(KEY, body);
    return res.status(200).json(body);
  } catch (error) {
    console.error("dashboard summary error:", error);
    return res.status(500).json({ error: "Failed to build dashboard summary" });
  }
};

/** Called by the write paths so a new order shows on the next load. */
exports.invalidate = () => cache.del(KEY);
