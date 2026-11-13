/**
 * What the big list endpoints send back.
 *
 * These were written twice: once in the controller that answers the request,
 * and once again in index.js for the background refresh that keeps the cache
 * warm. The two drifted - the controllers learned to send the keys that link
 * a quotation to its enquiry and an order to its quotation, the refresh did
 * not - so for two minutes after boot the lists carried those keys and from
 * then on they quietly did not, and every screen that shows a stage fell back
 * to asking for whole documents instead: two megabytes and thirty seconds a
 * list. One definition, read by both, is what stops that happening again.
 *
 * A field removed here disappears from a list screen; a field added costs
 * bytes on every one of 1,200-1,800 rows. Neither is free.
 */

/* enquiryId links a quotation back to the enquiry it came from. */
const QUOTATIONS =
  "quoteId enquiryId clientName clientNo quoteDate quoteTime endDate " +
  "executivename GrandTotal GST status createdAt discount " +
  "inchargeName labourecharge transportcharge";

/* quoteId links an order back to its quotation. slots.products is the bulk
   of an order document and no list screen draws it, so it stays out. */
const ORDERS =
  "orderId quoteId clientName clientNo executivename GrandTotal createdAt " +
  "Address orderStatus slots.slotName slots.quoteDate slots.endDate " +
  "slots.quoteTime";

const ENQUIRIES =
  "enquiryId clientName clientNo enquiryDate enquiryTime executivename " +
  "executiveId GrandTotal status createdAt";

module.exports = { QUOTATIONS, ORDERS, ENQUIRIES };
