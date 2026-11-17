const NodeCache = require("node-cache");
const listCache = require("../utils/listCache");
const Usermodel = require("../model/user");
const Ordermodel = require("../model/order");
const Enquirymodel = require("../model/enquiry");

/**
 * What each client has been up to: how many enquiries and orders, how much
 * business, and when they were last heard from.
 *
 * The clients screen worked all of this out in the browser, and to do it
 * downloaded every enquiry and every order - 490KB and 419KB - alongside the
 * client list, to end up with five numbers per client. This answers the same
 * question in about 20KB.
 *
 * The join is deliberately the same join the screen was doing, not a better
 * one: match on the last ten digits of the phone number, fall back to an
 * exact name match. That match is known to be weak - most orders carry no
 * clientNo at all, so most of them are found by name or not at all, and the
 * totals undercount as a result. Fixing that means putting a clientId on
 * orders, which is a migration over live data. Changing the rule here as well
 * would make the two changes impossible to tell apart afterwards, so this
 * keeps the old answer and the migration can change it on purpose.
 */

/* The three lists behind this change slowly; a minute is well inside how
   often anyone reloads the clients screen. */
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
const KEY = "client:activity";

/* Indian numbers are stored with and without the country code, so the last
   ten digits are the only part that identifies the same person. */
const phoneKey = (v) => {
  const digits = String(v || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};

const nameKey = (v) => String(v || "").trim().toLowerCase();

/**
 * When a record counts as an interaction.
 *
 * createdAt when it is there; otherwise the event date, which is written
 * DD-MM-YYYY. A forward-dated record is not an interaction yet - most event
 * dates are in the future - so it returns null rather than a date.
 */
const interactionTime = (rec) => {
  const created = rec && rec.createdAt ? new Date(rec.createdAt) : null;
  if (created && !Number.isNaN(created.getTime())) {
    return created.getTime() > Date.now() ? null : created.getTime();
  }

  const raw = String((rec && (rec.enquiryDate || rec.orderDate)) || "");
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (!dmy) return null;

  const [, d, m, y] = dmy;
  const at = Date.UTC(Number(y), Number(m) - 1, Number(d));
  return at > Date.now() ? null : at;
};

/* Every record filed under both keys it might be found by. */
const indexRows = (rows) => {
  const byPhone = new Map();
  const byName = new Map();

  rows.forEach((r) => {
    const p = phoneKey(r.clientNo != null ? r.clientNo : r.clientNumber);
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p).push(r);
    }
    const n = nameKey(r.clientName);
    if (n) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(r);
    }
  });

  return { byPhone, byName };
};

/* Phone first, name only when the phone finds nothing - the same order the
   screen used. */
const rowsFor = (index, client) => {
  const p = phoneKey(client.phoneNumber);
  if (p && index.byPhone.has(p)) return index.byPhone.get(p);
  const n = nameKey(client.name);
  if (n && index.byName.has(n)) return index.byName.get(n);
  return [];
};

const latest = (rows) => {
  let best = null;
  rows.forEach((r) => {
    const at = interactionTime(r);
    if (at != null && (best == null || at > best)) best = at;
  });
  return best;
};

exports.clientActivity = async (req, res) => {
  try {
    const hit = cache.get(KEY);
    if (hit) return res.status(200).json(hit);

    /* All three lists are already held in memory and refreshed in the
       background, and each carries the handful of fields this needs. Reading
       them again cost about 2.6 seconds on the first clients page opened
       after any write; taking the warm copy costs about fifty milliseconds
       and is no staler than the lists the same screen draws from. */
    const held = {
      clients: listCache.get(listCache.KEYS.clients),
      orders: listCache.get(listCache.KEYS.orders),
      enquiries: listCache.get(listCache.KEYS.enquiries),
    };

    const [clients, orders, enquiries] = await Promise.all([
      held.clients ||
        Usermodel.find({ role: "client" }, "name phoneNumber").lean(),
      held.orders ||
        Ordermodel.find({}, "clientNo clientName GrandTotal createdAt").lean(),
      held.enquiries ||
        Enquirymodel.find({}, "clientNo clientName createdAt enquiryDate").lean(),
    ]);

    const orderIndex = indexRows(orders);
    const enquiryIndex = indexRows(enquiries);

    const activity = {};
    clients.forEach((c) => {
      const cOrders = rowsFor(orderIndex, c);
      const cEnquiries = rowsFor(enquiryIndex, c);

      const lastOrder = latest(cOrders);
      const lastEnquiry = latest(cEnquiries);

      /* An order outranks an enquiry on the same day, which is what the
         screen did and reads correctly: the order is the later step. */
      let lastActivity = null;
      let lastKind = "";
      if (lastOrder != null && (lastEnquiry == null || lastOrder >= lastEnquiry)) {
        lastActivity = lastOrder;
        lastKind = "Order";
      } else if (lastEnquiry != null) {
        lastActivity = lastEnquiry;
        lastKind = "Enquiry";
      }

      /* A client nothing has ever been recorded against is left out rather
         than sent as a row of zeros - that is four hundred of the eight
         hundred, and the screen reads a missing entry as nothing anyway. */
      if (!cEnquiries.length && !cOrders.length) return;

      activity[String(c._id)] = {
        enquiries: cEnquiries.length,
        orders: cOrders.length,
        business: cOrders.reduce(
          (sum, o) => sum + (Number(o.GrandTotal) || 0),
          0
        ),
        lastActivity: lastActivity == null ? null : new Date(lastActivity).toISOString(),
        lastKind,
      };
    });

    const body = { activity };
    cache.set(KEY, body);
    return res.status(200).json(body);
  } catch (error) {
    console.error("client activity error:", error);
    return res.status(500).json({ error: "Failed to build client activity" });
  }
};

exports.invalidate = () => cache.del(KEY);

/**
 * One client's enquiries and orders, for the preview panel.
 *
 * The panel lists them, so it needs the records themselves and not just a
 * count - but only for the client being looked at, which is why this is a
 * separate call made when the panel opens rather than two whole collections
 * downloaded on page load in case someone clicks something.
 */
exports.clientHistory = async (req, res) => {
  try {
    const client = await Usermodel.findOne(
      { _id: req.params.id, role: "client" },
      "name phoneNumber"
    ).lean();

    if (!client) return res.status(404).json({ error: "Client not found" });

    const [orders, enquiries] = await Promise.all([
      Ordermodel.find({}, "orderId clientNo clientName GrandTotal createdAt").lean(),
      Enquirymodel.find(
        {},
        "enquiryId clientNo clientName GrandTotal createdAt enquiryDate"
      ).lean(),
    ]);

    /* Same match as the summary above, so the panel and the row it opened
       from can never disagree about how many there are. */
    const mine = (rows) => {
      const found = rowsFor(indexRows(rows), client);
      /* Newest first, which is the order the panel reads best in. */
      return found
        .slice()
        .sort((a, b) => (interactionTime(b) || 0) - (interactionTime(a) || 0));
    };

    return res.status(200).json({
      orders: mine(orders),
      enquiries: mine(enquiries),
    });
  } catch (error) {
    console.error("client history error:", error);
    return res.status(500).json({ error: "Failed to load client history" });
  }
};
