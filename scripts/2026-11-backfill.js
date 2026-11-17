#!/usr/bin/env node
/**
 * Fills in what the records never recorded.
 *
 *   node scripts/2026-11-backfill.js              # dry run, writes nothing
 *   node scripts/2026-11-backfill.js --apply      # writes
 *
 * A dry run is the default and --apply is the only way past it, because this
 * runs against live data that cannot be regenerated. Take a mongodump first
 * and read the dry run's counts before using it.
 *
 * NOTHING IS EVER DELETED. Records that point at something missing are
 * written to a CSV for someone to look at; they are left exactly as they are.
 *
 * What it fixes
 * -------------
 * H4  769 of 1,247 orders carry no clientNo, so the clients screen matches
 *     them by name or not at all and every client's totals undercount. Each
 *     order is given the clientId and clientNo from its quotation, falling
 *     back to a client whose name matches exactly. A name that two clients
 *     share is left alone and listed, because guessing which one would be
 *     worse than leaving it.
 *
 * H5  1,085 orders have no executive. Taken from the quotation, then from
 *     the enquiry behind it.
 *
 * L4  Executive names stored with trailing spaces - "Ananya ", "Lakshmi " -
 *     so the same person appears twice in a filter. Trimmed everywhere.
 *
 * M5  114 orders point at quotations that no longer exist and 8 quotations
 *     at missing enquiries. Listed in orphans.csv, not touched.
 *
 * eventDate: enquiryDate is a DD-MM-YYYY string, which no index can serve as
 * a range. A real Date is written alongside it so a month can one day be a
 * range query. Nothing reads it yet - the calendars match the string - so
 * this is groundwork, not a change in behaviour.
 *
 * What it deliberately does NOT do
 * --------------------------------
 * It does not rename statuses. The QA plan suggests folding order "Confirm"
 * into "confirmed" and quote "send" into "sent", and the vocabularies really
 * are a mess - but roughly thirty places across the backend and three
 * frontends compare against the current spellings, and renaming the data
 * without changing all of them in the same release would make every one of
 * those comparisons quietly false. That is a code change first and a data
 * change second, and it should be its own release.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

const Enquirymodel = require("../model/enquiry");
const Quotationmodel = require("../model/quotations");
const Ordermodel = require("../model/order");
const Usermodel = require("../model/user");

const trim = (v) => String(v == null ? "" : v).trim();

/* The last ten digits are the only part of an Indian number that reliably
   identifies the same person - the rest is country code or spacing. */
const phoneKey = (v) => {
  const digits = String(v || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};

const nameKey = (v) => trim(v).toLowerCase();

/** DD-MM-YYYY or YYYY-MM-DD to a Date at midnight IST, or null. */
const parseEventDate = (raw) => {
  const value = trim(raw);

  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(`${y}-${m}-${d}T00:00:00+05:30`);
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(`${y}-${m}-${d}T00:00:00+05:30`);
  }

  return null;
};

const csvCell = (v) => {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log(APPLY ? "\n=== APPLYING ===\n" : "\n=== DRY RUN - nothing will be written ===\n");

  const [enquiries, quotations, clients, orders] = await Promise.all([
    Enquirymodel.find(
      {},
      "enquiryId enquiryDate eventDate executiveId executivename clientNo clientName"
    ).lean(),
    Quotationmodel.find(
      {},
      "quoteId enquiryId clientId clientNo clientName executiveId executivename"
    ).lean(),
    Usermodel.find({ role: "client" }, "name phoneNumber").lean(),
    Ordermodel.find(
      {},
      "orderId quoteId clientId clientNo clientName executiveId executivename"
    ).lean(),
  ]);

  console.log(
    `read: ${enquiries.length} enquiries, ${quotations.length} quotations, ` +
      `${orders.length} orders, ${clients.length} clients`
  );

  const quoteById = new Map(quotations.map((q) => [String(q.quoteId), q]));
  const enquiryById = new Map(enquiries.map((e) => [String(e.enquiryId), e]));
  const clientByPhone = new Map();
  clients.forEach((c) => {
    const k = phoneKey(c.phoneNumber);
    if (k && !clientByPhone.has(k)) clientByPhone.set(k, c);
  });

  /* A name two clients share is marked AMBIGUOUS rather than picked between:
     attaching an order to the wrong company is worse than leaving it
     unattached, and it is far harder to notice afterwards. */
  const clientByName = new Map();
  clients.forEach((c) => {
    const k = nameKey(c.name);
    if (!k) return;
    clientByName.set(k, clientByName.has(k) ? "AMBIGUOUS" : c);
  });

  const enquiryOps = [];
  const quotationOps = [];
  const orderOps = [];
  const orphans = [];
  const ambiguous = [];

  const counts = {
    enquiryEventDate: 0,
    enquiryNameTrimmed: 0,
    quotationNameTrimmed: 0,
    orderClientFilled: 0,
    orderExecutiveFilled: 0,
    orderNameTrimmed: 0,
    ordersWithNoQuotation: 0,
    quotationsWithNoEnquiry: 0,
    ordersStillWithoutClient: 0,
    ordersStillWithoutExecutive: 0,
  };

  /* ---- Enquiries: eventDate and trimmed names ---- */
  enquiries.forEach((e) => {
    const set = {};

    const trimmed = trim(e.executivename);
    if (trimmed !== e.executivename && (e.executivename != null)) {
      set.executivename = trimmed;
      counts.enquiryNameTrimmed += 1;
    }

    if (!e.eventDate) {
      const at = parseEventDate(e.enquiryDate);
      if (at) {
        set.eventDate = at;
        counts.enquiryEventDate += 1;
      }
    }

    if (Object.keys(set).length) {
      enquiryOps.push({ updateOne: { filter: { _id: e._id }, update: { $set: set } } });
    }
  });

  /* ---- Quotations: trimmed names, and orphan check ---- */
  quotations.forEach((q) => {
    if (q.enquiryId != null && !enquiryById.has(String(q.enquiryId))) {
      counts.quotationsWithNoEnquiry += 1;
      orphans.push({
        kind: "quotation",
        id: q.quoteId,
        points_at: "enquiryId " + q.enquiryId,
        client: q.clientName,
      });
    }

    const trimmed = trim(q.executivename);
    if (q.executivename != null && trimmed !== q.executivename) {
      counts.quotationNameTrimmed += 1;
      quotationOps.push({
        updateOne: { filter: { _id: q._id }, update: { $set: { executivename: trimmed } } },
      });
    }
  });

  /* ---- Orders: client, executive, trimmed names, orphan check ---- */
  orders.forEach((o) => {
    const quote = o.quoteId != null ? quoteById.get(String(o.quoteId)) : null;
    const enquiry = quote && quote.enquiryId != null
      ? enquiryById.get(String(quote.enquiryId))
      : null;

    if (o.quoteId != null && !quote) {
      counts.ordersWithNoQuotation += 1;
      orphans.push({
        kind: "order",
        id: o.orderId,
        points_at: "quoteId " + o.quoteId,
        client: o.clientName,
      });
    }

    const set = {};

    /* --- who the client is --- */
    if (!o.clientId || !trim(o.clientNo)) {
      const phone = phoneKey(o.clientNo) || phoneKey(quote && quote.clientNo);
      let client = phone ? clientByPhone.get(phone) : null;

      if (!client) {
        const byName = clientByName.get(nameKey(o.clientName));
        if (byName === "AMBIGUOUS") {
          ambiguous.push({
            kind: "order",
            id: o.orderId,
            name: o.clientName,
            reason: "more than one client has this name",
          });
        } else if (byName) {
          client = byName;
        }
      }

      if (client) {
        if (!o.clientId) set.clientId = client._id;
        if (!trim(o.clientNo) && trim(client.phoneNumber)) {
          set.clientNo = trim(client.phoneNumber);
        }
        if (set.clientId || set.clientNo) counts.orderClientFilled += 1;
      } else {
        counts.ordersStillWithoutClient += 1;
      }
    }

    /* --- who the executive is --- */
    const executiveName =
      trim(o.executivename) ||
      trim(quote && quote.executivename) ||
      trim(enquiry && enquiry.executivename);

    const executiveId =
      o.executiveId ||
      (quote && quote.executiveId) ||
      (enquiry && enquiry.executiveId) ||
      null;

    if (executiveName && executiveName !== o.executivename) {
      set.executivename = executiveName;
      if (!trim(o.executivename)) counts.orderExecutiveFilled += 1;
      else counts.orderNameTrimmed += 1;
    }
    if (!o.executiveId && executiveId) set.executiveId = executiveId;

    if (!executiveName) counts.ordersStillWithoutExecutive += 1;

    if (Object.keys(set).length) {
      orderOps.push({ updateOne: { filter: { _id: o._id }, update: { $set: set } } });
    }
  });

  /* ---- Report ---- */
  console.log("\nwould change:");
  console.log(`  enquiries:  ${enquiryOps.length}`);
  console.log(`    eventDate written            ${counts.enquiryEventDate}`);
  console.log(`    executive name trimmed       ${counts.enquiryNameTrimmed}`);
  console.log(`  quotations: ${quotationOps.length}`);
  console.log(`    executive name trimmed       ${counts.quotationNameTrimmed}`);
  console.log(`  orders:     ${orderOps.length}`);
  console.log(`    client filled in             ${counts.orderClientFilled}`);
  console.log(`    executive filled in          ${counts.orderExecutiveFilled}`);
  console.log(`    executive name trimmed       ${counts.orderNameTrimmed}`);

  console.log("\nleft as they are:");
  console.log(`  orders pointing at a missing quotation   ${counts.ordersWithNoQuotation}`);
  console.log(`  quotations pointing at a missing enquiry ${counts.quotationsWithNoEnquiry}`);
  console.log(`  orders still with no client              ${counts.ordersStillWithoutClient}`);
  console.log(`  orders still with no executive           ${counts.ordersStillWithoutExecutive}`);
  console.log(`  orders whose client name is ambiguous    ${ambiguous.length}`);

  const outDir = path.join(__dirname, "backfill-output");
  fs.mkdirSync(outDir, { recursive: true });

  const writeCsv = (name, rows, header) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(
      file,
      [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(","))].join("\n")
    );
    console.log(`\nwrote ${file} (${rows.length} rows)`);
  };

  writeCsv("orphans.csv", orphans, ["kind", "id", "points_at", "client"]);
  writeCsv("ambiguous-names.csv", ambiguous, ["kind", "id", "name", "reason"]);

  if (!APPLY) {
    console.log("\nDry run: nothing was written. Re-run with --apply to write.\n");
    await mongoose.disconnect();
    return;
  }

  const run = async (label, Model, ops) => {
    if (!ops.length) return;
    const result = await Model.bulkWrite(ops, { ordered: false });
    console.log(`${label}: ${result.modifiedCount} modified`);
  };

  console.log("\nwriting...");
  await run("enquiries", Enquirymodel, enquiryOps);
  await run("quotations", Quotationmodel, quotationOps);
  await run("orders", Ordermodel, orderOps);
  console.log("done.\n");

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("\nbackfill failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
