const mongoose = require("mongoose");
const { parse } = require("date-fns");

const SlotSchema = new mongoose.Schema({
  slotName: {
    type: String,
    required: true,
  },
  quoteDate: {
    type: String,
    required: true,
  },
  quoteDateObj: {
    type: Date, // New Date field for easier filtering
  },
  endDate: {
    type: String,
    required: true,
  },
  endDateObj: {
    type: Date,
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productName: {
        type: String,
        required: true,
      },
      productPrice: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      total: {
        type: Number,
        required: true,
      },
      productQuoteDate: {
        type: String,
        required: true,
      },
      productEndDate: {
        type: String,
        required: true,
      },
      productSlot: {
        type: String,
        required: true,
      },
    },
  ],
});

const orderSchema = new mongoose.Schema({
  quoteId: {
    type: String,
    require: true,
    unique: true,
  },
  invoiceId: {
    type: String,
    require: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  executiveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  clientName: {
    type: String,
    required: true,
  },
  clientNo: {
    type: String,
    // required: true,
  },
  placeaddress: {
    type: String,
  },
  executivename: {
    type: String,
    require: true,
  },
  // startDate: {
  //   type: String,
  //   required: true,
  // },
  // endDate: {
  //   type: String,
  //   required: true,
  // },
  slots: {
    type: [SlotSchema], // Array of slots with associated products
    required: true,
  },
  products: [
    {
      productId: {
        type: String,
      },
      productName: {
        type: String,
        ref: "Product",
        // required: true,
      },
      quantity: {
        type: Number,
        // required: true,
      },
      total: {
        type: Number,
        // required: true,
      },
    },
  ],
  Address: {
    type: Object,
    required: true,
  },
  GrandTotal: {
    type: Number,
    required: true,
  },
  roundOff: {
    type: Number,
    required: true,
  },
  refurbishmentAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Cancelled"], // Ensures only valid statuses
    default: "Pending",
  },
  orderStatus: {
    type: String,
    enum: ["Confirm", "Approved", "Completed", "cancelled"], // Ensures only valid statuses
    default: "Confirm",
  },
  productrefurbishment: {
    type: Array,
  },
  damagerefurbishment: {
    type: String,
  },
  shippingaddressrefurbishment: {
    type: String,
  },
  expense: {
    type: Number,
  },
  floormanager: {
    type: String,
  },
  labourecharge: { type: Number, default: 0 },
  transportcharge: { type: Number, default: 0 },
  additionalTransportation: { type: Number, default: 0 },
  discount: {
    type: Number,
  },
  GST: {
    type: Number,
  },
  adjustments: {
    type: Number,
  },
 remarks: {
    type: String,
    default: "",
    trim: true,
  },


},
  {
    timestamps: true,
  }
);

orderSchema.pre("save", function (next) {
  if (this.slots && this.slots.length > 0) {
    this.slots = this.slots.map((slot) => {
      // Ensure slot is plain object
      const updatedSlot = slot.toObject ? slot.toObject() : slot;

      if (updatedSlot.quoteDate && !updatedSlot.quoteDateObj) {
        try {
          // Parse "dd-MM-yyyy"
          const parsedDate = parse(updatedSlot.quoteDate, "dd-MM-yyyy", new Date());

          // ✅ Normalize to UTC midnight
          updatedSlot.quoteDateObj = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()));
        } catch (e) {
          console.error("Invalid quoteDate:", updatedSlot.quoteDate, e);
        }
      }

      if (updatedSlot.endDate && !updatedSlot.endDateObj) {
        try {
          const parsedEndDate = parse(
            updatedSlot.endDate,
            "dd-MM-yyyy",
            new Date()
          );

          // Normalize to UTC midnight
          updatedSlot.endDateObj = new Date(
            Date.UTC(
              parsedEndDate.getFullYear(),
              parsedEndDate.getMonth(),
              parsedEndDate.getDate()
            )
          );
        } catch (e) {
          console.error("Invalid endDate:", updatedSlot.endDate, e);
        }
      }

      return updatedSlot;
    });
  }
  next();
});


// orderSchema.pre("save", function (next) {
//   if (this.slots && this.slots.length > 0) {
//     this.slots = this.slots.map((slot) => {
//       if (slot.quoteDate && !slot.quoteDateObj) {
//         try {
//           const parsed = parse(slot.quoteDate, "dd-MM-yyyy", new Date());
//           return { ...slot.toObject(), quoteDateObj: parsed };
//         } catch (e) {
//           console.error("Invalid quoteDate:", slot.quoteDate);
//           return slot;
//         }
//       }
//       return slot;
//     });
//   }
//   next();
// });


const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
