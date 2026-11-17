const Ordermodel = require("../model/order");

/**
 * What became of the order raised from each quotation.
 *
 * A quotation's own status field says pending, send or cancelled, and "send"
 * means an order was raised from it - but not whether that order still
 * stands. So the quotation screens read the order too, and to do that they
 * downloaded all 1,250 orders, 420KB, on every visit.
 *
 * Sending it with the row is the same trade the enquiry list makes: one
 * indexed read here instead of a second list over the wire.
 */

/**
 * @param {Array} rows quotations, each with a quoteId
 * @returns the same rows, each with orderState set to the lowercased status
 *          of its order - "confirm" or "cancelled" - or null where no order
 *          was ever raised from it.
 */
const withOrderState = async (rows) => {
  const quoteIds = rows.map((q) => q.quoteId).filter(Boolean);
  if (!quoteIds.length) return rows.map((q) => ({ ...q, orderState: null }));

  const orders = await Ordermodel.find({ quoteId: { $in: quoteIds } })
    .select("quoteId orderStatus")
    .lean();

  /* A quote re-confirmed after being called off reads as confirmed, so a
     confirmed order is never overwritten by a cancelled one. */
  const byQuote = new Map();
  orders.forEach((o) => {
    const key = String(o.quoteId || "");
    if (!key || byQuote.get(key) === "confirm") return;
    byQuote.set(key, String(o.orderStatus || "").toLowerCase());
  });

  return rows.map((q) => ({
    ...q,
    orderState: byQuote.get(String(q.quoteId || "")) || null,
  }));
};

module.exports = { withOrderState };
