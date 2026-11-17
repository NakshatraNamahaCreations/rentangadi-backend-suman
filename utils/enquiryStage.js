const Quotationmodel = require("../model/quotations");
const Ordermodel = require("../model/order");

/**
 * How far an enquiry got.
 *
 * The enquiry's own status field says only "sent" or "not send", and it
 * over-claims - hundreds read "sent" with no quotation behind them at all.
 * The real answer follows the enquiry to its quotation (quotations.enquiryId)
 * and the quotation to its order (orders.quoteId).
 *
 * The admin panel worked this out in the browser, which meant downloading
 * every quotation and every order - 900KB - before the Status column could
 * say anything. Until all three lists had arrived every status filter read
 * zero and the table said "Showing 1 to 0 of 0 entries", which is what people
 * reported as "Confirmed shows 0". Answering it here removes the race
 * entirely: the stage arrives with the row.
 *
 * Four stages, exclusive, so every enquiry has exactly one.
 */

/* A quote re-confirmed after being called off reads as confirmed, so the
   furthest stage wins rather than the last one seen. */
const RANK = { sent: 1, cancelled: 2, confirmed: 3 };

/**
 * @param {Array<number|string>} enquiryIds
 * @returns {Promise<Map<string, "sent"|"cancelled"|"confirmed">>}
 *          enquiries with no quotation are absent; callers read that as
 *          "pending", which is what no quotation means.
 */
async function stageAndTotals(enquiryIds) {
  const stages = new Map();
  /* What the enquiry was actually quoted at. An enquiry's own GrandTotal is
     one day of hire and never carries the rental days - not one of the 1,909
     does - so on the 410 multi-day ones it understates the job badly:
     enquiry 2283 stores 57,000 for 32 days of a 1,824,000 booking. Its
     quotation holds the real figure, and the quotations are already being
     read here for the stage, so it comes along for nothing. */
  const totals = new Map();

  if (!enquiryIds.length) return { stages, totals };

  const quotations = await Quotationmodel.find({
    enquiryId: { $in: enquiryIds },
  })
    .select("quoteId enquiryId status GrandTotal")
    .lean();

  if (!quotations.length) return { stages, totals };

  const orders = await Ordermodel.find({
    quoteId: { $in: quotations.map((q) => q.quoteId).filter(Boolean) },
  })
    .select("quoteId orderStatus")
    .lean();

  const orderByQuote = new Map();
  orders.forEach((o) => {
    const key = String(o.quoteId || "");
    if (!key || orderByQuote.get(key) === "confirm") return;
    orderByQuote.set(key, String(o.orderStatus || "").toLowerCase());
  });

  quotations.forEach((q) => {
    const key = String(q.enquiryId ?? "");
    if (!key) return;

    const orderState = orderByQuote.get(String(q.quoteId || ""));
    let stage = "sent";
    if (orderState === "confirm") stage = "confirmed";
    else if (orderState === "cancelled") stage = "cancelled";
    else if (String(q.status || "").toLowerCase() === "cancelled") {
      /* The quotation itself was withdrawn, before any order came of it. */
      stage = "cancelled";
    }

    /* One enquiry can carry several quotations; the furthest one wins, and
       the total shown is that same quotation's, so the figure and the stage
       never describe two different quotations. */
    const held = stages.get(key);
    if (!held || RANK[stage] > RANK[held]) {
      stages.set(key, stage);
      totals.set(key, Number(q.GrandTotal) || 0);
    }
  });

  return { stages, totals };
}

/**
 * @param {Array<number|string>} enquiryIds
 * @returns {Promise<Map<string, "sent"|"cancelled"|"confirmed">>}
 */
async function stageByEnquiry(enquiryIds) {
  const { stages } = await stageAndTotals(enquiryIds);
  return stages;
}

/**
 * The same rows back, each carrying the stage it is at and, where one was
 * raised, what its quotation came to.
 */
const withStage = async (rows) => {
  const { stages, totals } = await stageAndTotals(
    rows.map((e) => e.enquiryId).filter((x) => x != null)
  );
  return rows.map((e) => {
    const key = String(e.enquiryId ?? "");
    const quoted = totals.get(key);
    return {
      ...e,
      pipelineStatus: stages.get(key) || "pending",
      /* Absent rather than zero when nothing was quoted, so the screen can
         tell "quoted at nothing" from "never quoted". */
      quotedTotal: quoted != null && quoted > 0 ? quoted : null,
    };
  });
};

module.exports = { stageByEnquiry, stageAndTotals, withStage, RANK };
