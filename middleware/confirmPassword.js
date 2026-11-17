const bcrypt = require("bcryptjs");
const AdminModel = require("../model/Auth/adminLogin");

/**
 * Makes a request prove who is sending it, again.
 *
 * A token says the browser was logged in at some point; it does not say the
 * person at the keyboard is the one who logged in. For deleting a whole
 * enquiry, quotation or order - records that carry a client's history and
 * the money against it - that distinction is the point. So the admin's own
 * password has to come with the request.
 *
 * Sits after the token guard, which has already put the signed-in identity
 * on req.user, so the password is checked against THAT account and not
 * against whichever email the caller chose to send.
 *
 * Rate limiting is deliberately not repeated here: the request already
 * carries a valid token, so this is not an avenue for guessing a password
 * from outside. What it stops is a logged-in screen someone walked away
 * from.
 */

/* Kept out of the response, and out of the logs. */
const DENIED = "Password is not correct";

async function confirmPassword(req, res, next) {
  try {
    const password = req.body && req.body.password;

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "Enter your password to confirm this deletion",
        needsPassword: true,
      });
    }

    /* The account the token belongs to. Taking the email from the body would
       let anyone with any token delete by supplying someone else's
       credentials. */
    const email = req.user && req.user.email;

    if (!email) {
      return res.status(403).json({
        error: "Only a signed-in admin can delete this",
      });
    }

    const admin = await AdminModel.findOne({ email }).select("password role");

    if (!admin || !admin.password) {
      return res.status(403).json({
        error: "Only a signed-in admin can delete this",
      });
    }

    const ok = await bcrypt.compare(password, admin.password);

    if (!ok) {
      return res.status(401).json({ error: DENIED, needsPassword: true });
    }

    /* The password must not travel on into the handler, where it could end
       up in a log line or written onto a record. */
    delete req.body.password;

    return next();
  } catch (error) {
    console.error("password confirmation error:", error.message);
    return res.status(500).json({ error: "Could not confirm the password" });
  }
}

module.exports = confirmPassword;
