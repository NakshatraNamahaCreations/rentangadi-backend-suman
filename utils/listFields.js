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

/**
 * enquiryDate is the delivery date and endDate the dismantle date - the
 * enquiry form writes them from the "Delivery date" and "Dismantle date"
 * pickers, and the detail screen labels them that way. The date the enquiry
 * itself came in is createdAt. The list shows all three, so endDate is here:
 * it is one short string, about 19KB across the eighteen hundred rows.
 */
/* GST is here because an enquiry's GrandTotal has the tax inside it as a
   rupee amount on 573 of the 1,909, and the list has to take it back out to
   work out what the lines come to before applying the rental days. */
const ENQUIRIES =
  "enquiryId clientName clientNo enquiryDate endDate enquiryTime " +
  "executivename executiveId GrandTotal GST status createdAt";

/**
 * Clients are the one list that cannot use an inclusion projection.
 *
 * They live in the user collection, and the screens read companyName and
 * contactPersonNumber, which are in the documents but not in the schema -
 * naming the fields to keep would therefore drop both silently. So this
 * excludes instead: the password as before, and now the per-client
 * permissions object, which no screen reads and every row carried.
 *
 * role stays. It is one short string, it is what the list is filtered by, and
 * the executive panel is not accounted for well enough to be sure nothing
 * reads it.
 */
const CLIENTS = "-password -permissions";

/**
 * And the executives hanging off each client: the list showed their names
 * only, but every client carried the whole executive record - phone, email,
 * permissions, timestamps - for each one attached to it.
 */
const CLIENT_EXECUTIVES = "name phoneNumber email isActive";

module.exports = { QUOTATIONS, ORDERS, ENQUIRIES, CLIENTS, CLIENT_EXECUTIVES };
