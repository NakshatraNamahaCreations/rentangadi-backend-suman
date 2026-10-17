const crypto = require("crypto");
const googleTrends = require("google-trends-api");
const merchantId = "3663823";
const accessCode = "AVHX01LG55AF47XHFA";
const workingKey = "26BEB2F2DF6FEB5A6BF29F7259679061";
const redirectUrl = "YOUR_REDIRECT_URL";
const cancelUrl = "YOUR_CANCEL_URL";

// Function to encrypt request parameters
function getEncryptedRequest(data) {
  try {
    const queryString = Object.keys(data)
      .map((key) => `${key}=${encodeURIComponent(data[key])}`)
      .join("&");

    const cipher = crypto.createCipheriv(
      "aes-128-cbc",
      Buffer.from(workingKey, "hex"),
      "1234567890123456"
    );
    let encrypted = cipher.update(queryString, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch (error) {
    console.error("Error encrypting request:", error);
    throw new Error("Encryption failed");
  }
}

// Function to decrypt response parameters
function decryptResponse(encResponse) {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      Buffer.from(workingKey, "hex"),
      "1234567890123456"
    );
    let decrypted = decipher.update(encResponse, "hex", "utf8");
    decrypted += decipher.final("utf8");

    const responseParams = {};
    decrypted.split("&").forEach((param) => {
      const [key, value] = param.split("=");
      responseParams[key] = decodeURIComponent(value);
    });

    return responseParams;
  } catch (error) {
    console.error("Error decrypting response:", error);
    throw new Error("Decryption failed");
  }
}

class paymentgatway {
  async amazon(req, res) {
    const keywords = "yoga mat";

    const getTrends = async (keywords) => {
      try {
        const results = await googleTrends.interestOverTime({
          keyword: keywords,
          startTime: new Date("2024-06-01"),
          endTime: new Date(),
          granularity: "MONTH", // Specify granularity to get monthly data
        });

        // Check if the response is valid JSON
        let parsedResults;
        try {
          parsedResults = JSON.parse(results);
        } catch (jsonError) {
          console.error("Failed to parse JSON:", jsonError);
          throw new Error("Invalid JSON response from Google Trends API");
        }

        return parsedResults;
      } catch (error) {
        console.error("Google Trends API error:", error);
        throw error;
      }
    };

    try {
      const trendResults = await getTrends(keywords);

      if (
        trendResults &&
        trendResults.default &&
        trendResults.default.timelineData
      ) {
        // Calculate the total monthly search volume
        const totalSearchVolume = trendResults.default.timelineData.reduce(
          (total, month) => total + month.value[0],
          0
        );

        res.json({ totalMonthlySearchVolume: totalSearchVolume });
      } else {
        res.status(500).send("Error: No valid trend data found");
      }
    } catch (error) {
      res.status(500).send("Error retrieving trends data");
    }
  }

  async initiatePayment(req, res) {
    try {
      console.log("Received payment initiation request");
      const { orderId, amount } = req.body;
      console.log(`Order ID: ${orderId}, Amount: ${amount}`);

      const encRequest = getEncryptedRequest({
        merchant_id: merchantId,
        order_id: orderId,
        amount: amount,
        currency: "INR",
        redirect_url: redirectUrl,
        cancel_url: cancelUrl,
        language: "EN",
      });

      res.json({
        url: "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
        encRequest: encRequest,
        accessCode: accessCode,
      });
      console.log("Payment initiation response sent");
    } catch (error) {
      console.error("Error initiating payment:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  async paymentResponse(req, res) {
    try {
      console.log("Received payment response");
      const { encResp } = req.body;
      console.log(`Encrypted Response: ${encResp}`);
      const decryptedResponse = decryptResponse(encResp);

      if (decryptedResponse.order_status === "Success") {
        console.log("Payment was successful");
        res.send("Payment Successful");
      } else {
        console.log("Payment failed");
        res.send("Payment Failed");
      }
    } catch (error) {
      console.error("Error handling payment response:", error);
      res.status(500).send("Internal Server Error");
    }
  }
}

const paymentController = new paymentgatway();
module.exports = paymentController;
