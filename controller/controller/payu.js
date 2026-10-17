const crypto = require("crypto");
require("dotenv").config();

const axios = require("axios");

const { PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT, PAYU_ENVIRONMENT } = process.env;

if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
  throw new Error(
    "PayU merchant key and salt must be defined in the environment variables."
  );
}

class PaymentController {
  async initiatePayment(req, res) {
    try {
      const {
        amount,
        productinfo,
        firstname,
        email,
        phone,
        surl,
        txnid,
        furl,
      } = req.body;

      const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const paymentData = {
        key: PAYU_MERCHANT_KEY,
        txnid: txnid,
        amount: amount,
        productinfo: productinfo,
        firstname: firstname,
        email: email,
        phone: phone,
        surl: surl,
        furl: furl,
        hash: hash,
        enforce_paymethod:
          "creditcard|debitcard|netbanking|neftrtgs|emi|upi|cashcard|sodexo|bnpl|qr",
      };

      return res.json({
        paymentUrl: "https://secure.payu.in/_payment",
        params: paymentData,
      });
    } catch (error) {
      console.error("Payment Initialization Error:", error);
      res.status(500).json({
        message: "Payment Initialization Error",
        error: error.message,
      });
    }
  }

  async verifyPayment(req, res) {
    try {
      const txnid = req.params.txnid;

      const key = PAYU_MERCHANT_KEY;
      const command = "verify_payment";
      const var1 = txnid;

      const hashString = `${key}|${command}|${var1}|${PAYU_MERCHANT_SALT}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const encodedParams = new URLSearchParams();
      encodedParams.set("key", key);
      encodedParams.set("command", command);
      encodedParams.set("var1", var1);
      encodedParams.set("hash", hash);

      const options = {
        method: "POST",
        url: "https://test.payu.in/merchant/postservice?form=2",
        headers: {
          accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: encodedParams,
      };

      const response = await axios.request(options);

      if (response.data.status == 1) {
        return res.redirect("https://www.cndplay.com");
      } else {
        return res.redirect("errror");
      }
    } catch (error) {
      console.error("Payment Verification Error:", error);
      return res.status(500).json({
        message: "Payment Verification Error",
        error: error.message,
      });
    }
  }
}

module.exports = new PaymentController();
