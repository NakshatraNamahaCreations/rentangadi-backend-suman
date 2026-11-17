/**
 * Repairs a quotation's stored figures where they disagree with its own
 * lines.
 *
 * Two things are put right:
 *
 *   1. A line whose `total` is not quantity x price. A quotation line holds
 *      ONE DAY of money - QT3699 stores 3,000 for a sofa its order stores
 *      96,000 for over 32 days - so a day-multiplied figure in that field
 *      gets multiplied by the days a second time wherever it is read.
 *
 *   2. The GrandTotal, recomputed from the lines with the same util the
 *      screens use, so the list and the detail page stop disagreeing.
 *
 * DRY RUN unless --apply is passed. Touches those two fields and nothing
 * else: never deletes, never changes a product, a quantity, a price, a date
 * or a charge.
 *
 * Deliberately narrow. Only quotations named on the command line are
 * considered, and a record is skipped when the computed figure cannot be
 * trusted - no priced lines, or a discount of 100 or more, which eight
 * records carry and which would reduce a real total to zero.
 *
 *   node scripts/fix-quotation-totals.cjs QT3699
 *   node scripts/fix-quotation-totals.cjs QT3699 QT2746 --apply
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "..");
require(path.join(__dirname, "..", "node_modules", "dotenv")).config({
  path: path.join(__dirname, "..", ".env"),
});
const mongoose = require(path.join(__dirname, "..", "node_modules", "mongoose"));

/* The same util the screens use, so this cannot drift from them. */
const src = fs
  .readFileSync(path.join(ROOT, "src/utils/orderTotals.js"), "utf8")
  .replace(/export const /g, "const ")
  .concat("\nmodule.exports = { computeQuoteTotals };");
const mod = { exports: {} };
new Function("module", "exports", src)(mod, mod.exports);
const { computeQuoteTotals } = mod.exports;

const num = (v) => Number(v) || 0;
const APPLY = process.argv.includes("--apply");
const IDS = process.argv.filter((a) => /^QT\d+$/i.test(a)).map((s) => s.toUpperCase());

(async () => {
  if (!IDS.length) {
    console.log("name at least one quotation, e.g. QT3699");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const col = mongoose.connection.collection("quotations");

  console.log(APPLY ? "APPLYING" : "DRY RUN - nothing will be written", "\n");

  for (const id of IDS) {
    const q = await col.findOne({ quoteId: id });
    if (!q) {
      console.log(id, "- not found");
      continue;
    }

    console.log(id);

    /* ---- 1. lines ---- */
    const slots = JSON.parse(JSON.stringify(q.slots || []));
    const fixedLines = [];

    slots.forEach((s) => {
      const list = s.Products || s.products || [];
      list.forEach((p) => {
        const qty = num(p.qty ?? p.quantity);
        const price = num(p.price);
        if (!qty || !price) return;
        const should = qty * price;
        if (Math.abs(num(p.total) - should) <= 1) return;
        fixedLines.push({
          name: p.productName || p.name,
          was: num(p.total),
          now: should,
        });
        p.total = should;
      });
    });

    fixedLines.forEach((l) =>
      console.log("   line:", String(l.name).slice(0, 30).padEnd(32), l.was, "->", l.now)
    );
    if (!fixedLines.length) console.log("   lines: all already qty x price");

    /* ---- 2. the total, from the repaired lines ---- */
    const repaired = { ...q, slots };
    const t = computeQuoteTotals(repaired);
    const stored = num(q.GrandTotal);
    const computed = t ? Math.round(t.totalAfterCharges + t.gstAmount) : 0;

    if (!t || t.productsTotal <= 0) {
      console.log("   total: skipped, no priced lines\n");
      continue;
    }
    if (num(q.discount) >= 100) {
      console.log("   total: skipped, discount is", q.discount, "\n");
      continue;
    }

    const totalNeedsFixing = Math.abs(stored - computed) > 2;

    if (totalNeedsFixing) {
      console.log(
        "   total:", stored, "->", computed,
        " (sub-total", t.productsTotal, "+ GST", t.gstAmount + ")"
      );
    } else {
      console.log("   total: already correct at", stored);
    }

    if (APPLY && (fixedLines.length || totalNeedsFixing)) {
      const set = {};
      if (fixedLines.length) set.slots = slots;
      if (totalNeedsFixing) set.GrandTotal = computed;
      const r = await col.updateOne({ _id: q._id }, { $set: set });
      console.log("   written:", r.modifiedCount === 1 ? "yes" : "no change");
    }

    console.log();
  }

  if (!APPLY) console.log("nothing written. add --apply to write.");
  await mongoose.disconnect();
})().catch((x) => {
  console.error("FAILED", x.message);
  process.exit(1);
});
