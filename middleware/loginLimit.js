/**
 * A cap on how often one address may try to log in.
 *
 * Without it the login endpoints answer as fast as they are asked, which is
 * all a password-guessing script needs. Kept in memory deliberately: it costs
 * nothing, needs no Redis to be running for logins to work at all, and the
 * window is short enough that losing the counters on a restart does not
 * matter.
 *
 * One process only. Behind several, each keeps its own count, so the real
 * limit is max x processes - still far below what guessing needs, and worth
 * revisiting if this is ever run clustered.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

const attempts = new Map();

/* Dropped on a timer rather than on every request, so one address cannot
   make the map grow without bound by never coming back. */
const sweep = () => {
  const now = Date.now();
  attempts.forEach((entry, key) => {
    if (now - entry.start >= WINDOW_MS) attempts.delete(key);
  });
};
setInterval(sweep, WINDOW_MS).unref?.();

/**
 * Behind nginx every request arrives from 127.0.0.1, so the forwarded address
 * is read first. It can be spoofed by a client talking to the API directly;
 * that only lets an attacker spread their own attempts across made-up
 * addresses, which is no worse than having no limit, and it keeps one office
 * behind one NAT from locking itself out.
 */
const addressOf = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
};

function loginLimit(req, res, next) {
  const key = addressOf(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.start >= WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.start + WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many login attempts",
      retryAfterSeconds: retryAfter,
    });
  }

  return next();
}

/** A successful login clears the count, so normal use never trips the cap. */
loginLimit.clear = (req) => attempts.delete(addressOf(req));

module.exports = loginLimit;
