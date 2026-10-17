// by sonali

const moment = require("moment");
const Order = require("../model/order");
const { dateDiff } = require("./dateString");

const calculateOrderTotal = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    // don't use res here; this is a helper
    throw new Error("Order not found");
  }

  let allProductsTotal = 0;

  for (const slot of order.slots || []) {
    for (const product of slot.products || []) {
      const days = dateDiff(
        product.productQuoteDate || slot.quoteDate,
        product.productEndDate || slot.endDate
      );

      const price = Number(product.productPrice) || 0;
      const qty = Number(product.quantity) || 0;

      const total = price * qty * days;
      allProductsTotal += total;

      product.days = days;
      product.total = total;
    }
  }

  const transport = Number(order.transportcharge || 0);
  const manpower = Number(order.labourecharge || 0);
  const refurb = Number(order.refurbishmentAmount || 0);
  const discountPercent = Number(order.discount || 0);
  const additionalTransportation = Number(order.additionalTransportation || 0);
  const gstPercent = Number(order.GST || 0);

  const discountAmt = (discountPercent / 100) * allProductsTotal;
  const afterDiscount = allProductsTotal - discountAmt;
  const totalWithCharges =
    afterDiscount + transport + manpower + refurb + additionalTransportation;

  const gstAmt = (gstPercent / 100) * totalWithCharges;
  const grandTotal = totalWithCharges + gstAmt;

  return {
    order,
    breakdown: { gstAmt, grandTotal },
  };
};

module.exports = calculateOrderTotal;

// const moment = require("moment");
// const Order = require("../model/order");
// const { dateDiff } = require("./dateString");

// const calculateOrderTotal = async (orderId, newAdditionalTransportation) => {

//   const order = await Order.findById(orderId);
//   if (!order) {
//     return res.status(400).json({ message: "Order not found" });
//   }

//   let allProductsTotal = 0;

//   // Sum up all slot products’ totals      
//   for (const product of order?.slots[0]?.products) {
//     // console.log(`product ${product.productName} & total:${product.total} `,);
//     console.log(`product: `, product);

//     // allProductsTotal += Number(product.total) || 0;
//     const days = dateDiff(product.productQuoteDate || order.slots[0].quoteDate, product.productEndDate || order.slots[0].endDate);
//     const price = Number(product.productPrice) || 0;
//     const qty = Number(product.quantity) || 0;

//     const total = price * qty * days;
//     console.log({ days, price, qty });
//     allProductsTotal += total;

//     // update product info for reference
//     product.days = days;
//     product.total = total;

//   }

//   const transport = Number(order?.transportcharge || 0);
//   const manpower = Number(order?.labourecharge || 0);
//   const refurb = Number(order?.refurbishmentAmount || 0);
//   const discountPercent = Number(order?.discount || 0);
//   const additionalTransportation = Number(newAdditionalTransportation || 0);
//   const gstPercent = Number(order?.GST || 0);

//   const discountAmt = (discountPercent / 100) * allProductsTotal;
//   const afterDiscount = allProductsTotal - discountAmt;
//   const totalWithCharges = afterDiscount + transport + manpower + refurb + additionalTransportation;
//   const gstAmt = (gstPercent / 100) * totalWithCharges;
//   const grandTotal = totalWithCharges + gstAmt;

//   console.log("grandTotal:", grandTotal);

//   return {
//     order,
//     breakdown: {
//       // subtotal,
//       // discountAmt,
//       // totalBeforeCharges,
//       // totalAfterCharges,
//       gstAmt,
//       grandTotal
//     }
//   };
// }

// module.exports = calculateOrderTotal;
