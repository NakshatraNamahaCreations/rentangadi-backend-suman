const Quotationmodel = require("../model/quotations");
const Enquirymodel = require("../model/enquiry");

/**
 * A product added to an order, added to the quotation and the enquiry it
 * came from.
 *
 * An order is raised from a quotation (order.quoteId) which was raised from
 * an enquiry (quotation.enquiryId), and adding a product on the order used
 * to touch only the order - so the same job showed three different sets of
 * products depending on which screen it was opened from. This puts the line
 * on all three.
 *
 *
 * WHY THE TOTALS ARE ADDED TO RATHER THAN RECALCULATED
 *
 * The obvious move is to re-add the lines and recompute each GrandTotal from
 * the document's own discount, charges and GST. Measured against the live
 * data, that restates money on records nobody touched:
 *
 *   - recomputing quotations with the formula in controller/quotations.js
 *     reproduces 1,177 of 1,393 exactly and 113 more within a rupee, but
 *     moves the other 103 - some wildly (QT2439 stored 540,440, recomputed
 *     0; QT1839 stored 4,130, recomputed 12,390).
 *
 *   - on enquiries, GrandTotal does not equal the sum of the line totals on
 *     572 of 1,906, because GST is held there as a rupee amount and is
 *     included in the total (4,000 of lines + 720 of GST = 4,720). The
 *     existing /Enquiry/add/:id endpoint sets GrandTotal to the sum of the
 *     lines, so adding a product through it silently strips the GST off the
 *     enquiry. That bug is the reason this does not reuse it.
 *
 * And the two collections do not even agree on what GST means: on a
 * quotation it is a percentage (every one of the 1,393 holds 18), on an
 * enquiry it is an amount in rupees.
 *
 * So nothing already stored is recalculated. The new line is appended, and
 * the stored GrandTotal grows by that line scaled the way the document
 * already scales its own lines:
 *
 *     ratio       = storedGrandTotal / sumOfExistingLineTotals
 *     newTotal    = storedGrandTotal + newLineTotal * ratio
 *
 * which carries that record's own discount, charges and GST - whatever they
 * actually were - onto the new line without re-deriving anything. Every
 * existing figure is left exactly as it is.
 */

const num = (v) => Number(v) || 0;

/* Quotation slots are "Products" with a capital P on all 1,393 of them;
   orders use "products". Both are read anyway, so a stray document in the
   other shape is not skipped. */
const slotProducts = (slot) =>
  (slot && (Array.isArray(slot.Products) ? slot.Products : slot.products)) || [];

const sumLines = (products) => products.reduce((s, p) => s + num(p.total), 0);

/**
 * What the stored total becomes once this line is on the document.
 *
 * A flat ratio of total-to-lines is wrong, because part of the total does
 * not scale with the products at all: labour and transport are charged once
 * for the job, not per item. On QT1801 - 69,000 of lines, 16,500 of charges,
 * GST 18 - a flat ratio charges a new 5,000 line at 2.64x and adds 13,211,
 * a third of which is a second helping of a delivery fee already paid.
 *
 * So the fixed part is taken out first, and only what is left is treated as
 * proportional to the lines:
 *
 *     storedTotal = (lines * perUnit * (1 - discount) + fixed) * gstFactor
 *
 * is solved for perUnit - which in practice comes out as the number of
 * rental days, 2.0 on QT1801 - and the new line is charged at that same
 * rate:
 *
 *     delta = newLine * perUnit * (1 - discount) * gstFactor
 *
 * Nothing already stored is touched; the total only grows by what this one
 * line is worth on this record's own terms.
 *
 * If the figures cannot support that - no lines yet, or a stored total so
 * far below the fixed charges that perUnit comes out zero or negative, which
 * happens on records where the total was typed in by hand - it falls back to
 * charging the line with discount and GST and no day multiplier. That is the
 * conservative answer: it can undercharge a multi-day hire, never invent
 * money that was not there.
 */
const grownTotal = (storedTotal, linesBefore, newLineTotal, opts = {}) => {
  const stored = num(storedTotal);
  const fixed = num(opts.fixed);
  const afterDiscount = 1 - num(opts.discountPercent) / 100;
  const gstFactor = 1 + num(opts.gstPercent) / 100;

  const plain = () => Math.round(stored + newLineTotal * afterDiscount * gstFactor);

  if (linesBefore <= 0) return plain();

  const proportional = stored / gstFactor - fixed;
  const perUnit = proportional / afterDiscount / linesBefore;

  if (!Number.isFinite(perUnit) || perUnit <= 0) return plain();

  return Math.round(stored + newLineTotal * perUnit * afterDiscount * gstFactor);
};

/* The slot on the quotation that covers the same dates as the order's slot.
   Falling back to the first one matches how the rest of the code treats a
   quotation, which in this data always has exactly one slot. */
const matchingSlot = (slots, quoteDate, endDate) => {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const hit = slots.find(
    (s) => s.quoteDate === quoteDate && s.endDate === endDate
  );
  return hit || slots[0];
};

const alreadyThere = (products, productId) =>
  products.some((p) => String(p.productId) === String(productId));

/**
 * Puts products onto an enquiry that are not on it yet.
 *
 * Shared by both directions - a product added on the order and a product
 * added on the quotation both end up here - so the enquiry is written the
 * same way whichever screen the product came from.
 *
 * Only ever adds. A product taken off a quotation is left on the enquiry:
 * the enquiry is the record of what was asked for, and quietly deleting
 * from it would lose that.
 *
 * An enquiry line holds one day's money - enquiry 4118 stores 3,000 for the
 * sofa its quotation stores 96,000 for, the difference being the 32 day
 * hire - so the total is taken as qty x price and never copied across from
 * the quotation line.
 */
async function addMissingToEnquiry({ session, enquiryId, products }) {
  if (!enquiryId) return { status: "no enquiryId", added: 0 };

  const enquiry = await Enquirymodel.findOne({
    enquiryId: Number(enquiryId),
  }).session(session);

  if (!enquiry) return { status: "not found", added: 0 };

  const lines = enquiry.products || [];
  const missing = products.filter(
    (p) => p && p.productId && !alreadyThere(lines, p.productId)
  );

  if (missing.length === 0) return { status: "already listed", added: 0 };

  /* The rate is read off what this enquiry already charges, and taken
     before anything is pushed so the additions do not feed into it. */
  const linesBefore = sumLines(lines);
  const gstRate = linesBefore > 0 ? num(enquiry.GST) / linesBefore : 0;
  const gstBefore = num(enquiry.GST);

  let addedValue = 0;

  missing.forEach((p) => {
    const qty = num(p.qty);
    const price = num(p.price);
    const total = qty * price;
    addedValue += total;

    lines.push({
      productId: p.productId,
      productName: p.productName,
      qty,
      price,
      total,
      productImage: p.productImage || "",
    });
  });

  if (gstRate > 0) {
    enquiry.GST = Math.round(gstBefore + addedValue * gstRate);
  }

  enquiry.GrandTotal = grownTotal(enquiry.GrandTotal, linesBefore, addedValue, {
    /* GST already sits inside an enquiry's GrandTotal, so it is the part
       that must not scale with the lines. */
    fixed: gstBefore,
    discountPercent: num(enquiry.discount),
    gstPercent: 0,
  });

  enquiry.GrandTotal = Math.round(
    num(enquiry.GrandTotal) + addedValue * gstRate
  );

  enquiry.products = lines;
  enquiry.markModified("products");
  await enquiry.save({ session });

  return { status: "added", added: missing.length };
}

/**
 * Takes a product off an enquiry.
 *
 * The mirror of addMissingToEnquiry, and the same arithmetic in reverse: the
 * line comes off at the rate this enquiry already charges, and the GST
 * figure - which on an enquiry is a rupee amount sitting inside GrandTotal -
 * is reduced by that line's share of it. Re-adding the remaining lines
 * instead would throw the tax away on the 573 enquiries that carry one.
 */
async function removeFromEnquiry({ session, enquiryId, productId }) {
  if (!enquiryId) return { status: "no enquiryId", removed: 0 };

  const enquiry = await Enquirymodel.findOne({
    enquiryId: Number(enquiryId),
  }).session(session);

  if (!enquiry) return { status: "not found", removed: 0 };

  const lines = enquiry.products || [];
  const going = lines.filter((p) => String(p.productId) === String(productId));

  if (going.length === 0) return { status: "not listed", removed: 0 };

  const linesBefore = sumLines(lines);
  const removedValue = sumLines(going);
  const gstBefore = num(enquiry.GST);
  const gstRate = linesBefore > 0 ? gstBefore / linesBefore : 0;

  const kept = lines.filter((p) => String(p.productId) !== String(productId));

  const newGST = gstRate > 0 ? Math.round(gstBefore - removedValue * gstRate) : gstBefore;

  let total = grownTotal(enquiry.GrandTotal, linesBefore, -removedValue, {
    fixed: gstBefore,
    discountPercent: num(enquiry.discount),
    gstPercent: 0,
  });
  total = Math.round(total - removedValue * gstRate);

  /* Never below what is left plus its tax. */
  const floor = Math.round(sumLines(kept) + newGST);
  if (total < floor) total = floor;

  enquiry.products = kept;
  enquiry.GST = newGST;
  enquiry.GrandTotal = total;
  enquiry.markModified("products");
  await enquiry.save({ session });

  return { status: "removed", removed: going.length };
}

/**
 * Changes a line's quantity or price on the quotation an order came from,
 * and on the enquiry behind it.
 *
 * Adding and removing were carried across; editing was not, so changing a
 * quantity on the order left the other two screens describing a different
 * job. This closes that.
 *
 * Only what actually changed is written. A quotation and an enquiry both
 * hold ONE DAY of money per line, so the new total is quantity x price and
 * never the order's figure, which carries the whole hire.
 */
async function updateProductEverywhere({
  session,
  quoteId,
  productId,
  qty,
  price,
  quoteDate,
  endDate,
}) {
  const result = { quotation: "not found", enquiry: "not found", quoteId, enquiryId: null };

  if (!quoteId) {
    result.quotation = "no quoteId on the order";
    result.enquiry = "no quoteId on the order";
    return result;
  }

  const newQty = num(qty);
  const newPrice = num(price);
  const newLine = newQty * newPrice;

  const quotation = await Quotationmodel.findOne({ quoteId }).session(session);
  if (!quotation) return result;

  /* ---- the quotation ---- */
  const slot = matchingSlot(quotation.slots, quoteDate, endDate);

  if (!slot) {
    result.quotation = "no slot to update";
  } else {
    const list = slotProducts(slot);
    const line = list.find((p) => String(p.productId) === String(productId));

    if (!line) {
      result.quotation = "not listed";
    } else {
      const linesBefore = sumLines(list);
      const was = num(line.total);

      if (Math.abs(was - newLine) < 0.5 && num(line.qty ?? line.quantity) === newQty) {
        result.quotation = "unchanged";
      } else {
        line.qty = newQty;
        line.quantity = newQty;
        line.price = newPrice;
        line.total = newLine;

        quotation.GrandTotal = grownTotal(
          quotation.GrandTotal,
          linesBefore,
          newLine - was,
          {
            fixed:
              num(quotation.labourecharge) +
              num(quotation.transportcharge) +
              num(quotation.refurbishment),
            discountPercent: num(quotation.discount),
            gstPercent: num(quotation.GST),
          }
        );

        if (quotation.GrandTotal < 0) quotation.GrandTotal = 0;

        quotation.markModified("slots");
        await quotation.save({ session });
        result.quotation = "updated";
      }
    }
  }

  /* ---- the enquiry behind it ---- */
  result.enquiryId = quotation.enquiryId || null;

  if (!quotation.enquiryId) {
    result.enquiry = "quotation has no enquiryId";
    return result;
  }

  const enquiry = await Enquirymodel.findOne({
    enquiryId: Number(quotation.enquiryId),
  }).session(session);

  if (!enquiry) return result;

  const lines = enquiry.products || [];
  const line = lines.find((p) => String(p.productId) === String(productId));

  if (!line) {
    result.enquiry = "not listed";
    return result;
  }

  const linesBefore = sumLines(lines);
  const was = num(line.total);

  if (Math.abs(was - newLine) < 0.5 && num(line.qty) === newQty) {
    result.enquiry = "unchanged";
    return result;
  }

  const gstBefore = num(enquiry.GST);
  const gstRate = linesBefore > 0 ? gstBefore / linesBefore : 0;
  const delta = newLine - was;

  line.qty = newQty;
  line.price = newPrice;
  line.total = newLine;

  if (gstRate > 0) {
    enquiry.GST = Math.round(gstBefore + delta * gstRate);
  }

  let total = grownTotal(enquiry.GrandTotal, linesBefore, delta, {
    fixed: gstBefore,
    discountPercent: num(enquiry.discount),
    gstPercent: 0,
  });
  total = Math.round(total + delta * gstRate);
  if (total < 0) total = 0;

  enquiry.GrandTotal = total;
  enquiry.products = lines;
  enquiry.markModified("products");
  await enquiry.save({ session });
  result.enquiry = "updated";

  return result;
}

/**
 * Takes a product off the quotation an order came from, and off the enquiry
 * behind that quotation.
 *
 * The counterpart of propagateProduct below, so a product removed on the
 * order stops showing on the other two screens instead of lingering there.
 * Nothing throws on a missing record: 114 of the orders came from a
 * quotation that is gone, and on those the removal still has to work.
 */
async function removeProductEverywhere({ session, quoteId, productId, quoteDate, endDate }) {
  const result = { quotation: "not found", enquiry: "not found", quoteId, enquiryId: null };

  if (!quoteId) {
    result.quotation = "no quoteId on the order";
    result.enquiry = "no quoteId on the order";
    return result;
  }

  const quotation = await Quotationmodel.findOne({ quoteId }).session(session);
  if (!quotation) return result;

  const slot = matchingSlot(quotation.slots, quoteDate, endDate);

  if (!slot) {
    result.quotation = "no slot to remove from";
  } else {
    const list = slotProducts(slot);
    const going = list.filter((p) => String(p.productId) === String(productId));

    if (going.length === 0) {
      result.quotation = "not listed";
    } else {
      const linesBefore = sumLines(list);
      const removedValue = sumLines(going);
      const kept = list.filter((p) => String(p.productId) !== String(productId));

      if (Array.isArray(slot.Products)) slot.Products = kept;
      else slot.products = kept;

      quotation.GrandTotal = grownTotal(
        quotation.GrandTotal,
        linesBefore,
        -removedValue,
        {
          fixed: num(quotation.labourecharge) + num(quotation.transportcharge) + num(quotation.refurbishment),
          discountPercent: num(quotation.discount),
          gstPercent: num(quotation.GST),
        }
      );

      if (quotation.GrandTotal < 0) quotation.GrandTotal = 0;

      quotation.markModified("slots");
      await quotation.save({ session });
      result.quotation = "removed";
    }
  }

  result.enquiryId = quotation.enquiryId || null;

  const offEnquiry = await removeFromEnquiry({
    session,
    enquiryId: quotation.enquiryId,
    productId,
  });

  result.enquiry =
    offEnquiry.status === "no enquiryId"
      ? "quotation has no enquiryId"
      : offEnquiry.status;

  return result;
}

/**
 * Adds the line to the quotation behind this order and to the enquiry behind
 * that quotation.
 *
 * Nothing here throws on a missing record: 114 of the 1,342 orders carry a
 * quoteId that matches no quotation and 7 quotations point at an enquiry
 * that is gone, and on those the product still belongs on the order. The
 * caller is told what was reached so the screen can say so.
 */
async function propagateProduct({
  session,
  quoteId,
  product, // { productId, productName, qty, price, total, productImage }
  quoteDate,
  endDate,
  productSlot,
}) {
  const result = { quotation: "not found", enquiry: "not found", quoteId, enquiryId: null };

  if (!quoteId) {
    result.quotation = "no quoteId on the order";
    result.enquiry = "no quoteId on the order";
    return result;
  }

  const quotation = await Quotationmodel.findOne({ quoteId }).session(session);

  if (!quotation) return result;

  /* ---- the quotation ---- */
  const slot = matchingSlot(quotation.slots, quoteDate, endDate);

  if (!slot) {
    result.quotation = "no slot to add to";
  } else {
    const list = slotProducts(slot);

    if (alreadyThere(list, product.productId)) {
      result.quotation = "already listed";
    } else {
      const linesBefore = sumLines(list);

      /**
       * A quotation line holds ONE DAY of money, and an order line holds the
       * whole hire.
       *
       * QT3699 stores 3,000 and 4,000 against an order that stores 96,000
       * and 128,000 for the same two sofas over 32 days. The caller hands
       * over the order's figure, so copying it onto the quotation put a
       * 32 day total into a per-day field - and the quotation then
       * multiplied it by the days a second time. One 1,500 sofa turned a
       * 320,960 quotation into 2,076,800.
       *
       * So the quotation line is priced from quantity and price, never from
       * the total that came in.
       */
      const perDayTotal = num(product.qty) * num(product.price);

      list.push({
        productId: product.productId,
        productName: product.productName,
        /* Both keys: 3,687 of the stored lines carry qty and quantity, and
           different screens read different ones. */
        qty: product.qty,
        quantity: product.qty,
        price: product.price,
        total: perDayTotal,
        productImage: product.productImage || "",
        stock: product.stock,
        productQuoteDate: quoteDate,
        productEndDate: endDate,
        productSlot,
      });

      if (Array.isArray(slot.Products)) slot.Products = list;
      else slot.products = list;

      /* On a quotation GST is a percentage - all 1,393 hold 18 - and labour
         and transport are the charges that must not scale with the line.
         linesBefore is a sum of per-day totals, so the new line has to be
         measured the same way or the two are not comparable. */
      quotation.GrandTotal = grownTotal(
        quotation.GrandTotal,
        linesBefore,
        perDayTotal,
        {
          fixed:
            num(quotation.labourecharge) +
            num(quotation.transportcharge) +
            num(quotation.refurbishment),
          discountPercent: num(quotation.discount),
          gstPercent: num(quotation.GST),
        }
      );

      quotation.markModified("slots");
      await quotation.save({ session });
      result.quotation = "added";
    }
  }

  /* ---- the enquiry behind it ---- */
  result.enquiryId = quotation.enquiryId || null;

  const onEnquiry = await addMissingToEnquiry({
    session,
    enquiryId: quotation.enquiryId,
    products: [product],
  });

  result.enquiry =
    onEnquiry.status === "no enquiryId"
      ? "quotation has no enquiryId"
      : onEnquiry.status;

  return result;
}

module.exports = {
  propagateProduct,
  updateProductEverywhere,
  removeProductEverywhere,
  addMissingToEnquiry,
  removeFromEnquiry,
  grownTotal,
  sumLines,
  matchingSlot,
};
