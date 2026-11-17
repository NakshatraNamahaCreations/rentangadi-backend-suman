const jwt = require("jsonwebtoken");
const JWT_SECRET_KEY = require("../config/jwtSecret");

/**
 * Who may call the API.
 *
 * Every data route used to answer anyone who asked: the full enquiry, client
 * and order collections came back with a 200 to a request carrying no cookie
 * and no header at all. The guard below closes that, and it is deliberately
 * arranged the other way round from the obvious one - everything under /api
 * needs a token unless it is named as public, so a route added tomorrow is
 * shut by default rather than open by oversight.
 *
 * It only establishes *who* is calling. Deciding what each role may then do
 * is a separate question and a wider change: the executive panel presently
 * calls nearly the whole API, so restricting by role has to follow a decision
 * about what an executive is allowed to see, not precede it. requireAuth()
 * takes a role list for the routes where that answer is already clear, and
 * req.user carries the role for the handlers that want to narrow a query.
 */

/* The roles that run the admin panel. "warehouse" is a limited admin rather
   than a separate kind of user - the panel decides what it sees from the
   permissions object on the token. */
const ADMIN_ROLES = ["admin", "superAdmin", "warehouse"];

/**
 * Open to the world, because something that has no account has to reach them:
 * the public website's catalogue and enquiry form, the login endpoints
 * themselves, and the payment gateway's server-to-server callbacks, which
 * arrive from the gateway and carry nothing of ours.
 *
 * Paths are matched after Express has stripped the /api prefix, without the
 * query string, and without regard to case - the frontends spell /Enquiry and
 * /enquiry interchangeably and Express routes both to the same handler, so a
 * case-sensitive list here would let one spelling past the guard and not the
 * other.
 */
const PUBLIC = [
  /* Says whether this deployment can reach the database. Names no secret. */
  { method: "GET", path: /^\/health$/ },

  /* The logins. Nobody has a token before calling one of these. */
  { method: "POST", path: /^\/adminLogin$/ },
  { method: "POST", path: /^\/user\/(login|signup|executiveLogin)$/ },
  { method: "POST", path: /^\/client\/clientlogin$/ },

  /* The public catalogue, as the website reads it. */
  { method: "GET", path: /^\/product\/getProducts$/ },
  { method: "GET", path: /^\/product\/getinventoryproducts$/ },
  { method: "GET", path: /^\/product\/product-details\/[^/]+$/ },
  { method: "POST", path: /^\/product\/getProductbycategory$/ },
  { method: "GET", path: /^\/subcategory\/getappsubcat$/ },
  { method: "GET", path: /^\/category\/(getcategory|getallcategory)$/ },
  { method: "GET", path: /^\/banner\/getallbanner$/ },
  { method: "GET", path: /^\/termscondition\/findwithcategory$/ },

  /* A visitor sending an enquiry from the website has no account yet. */
  { method: "POST", path: /^\/Enquiry\/createEnquiry$/ },

  /* Payment gateway callbacks: the request comes from PayU or CCAvenue, and
     is authenticated by its own signed hash, not by a token of ours. */
  { method: "POST", path: /^\/hash$/ },
  { method: "POST", path: /^\/success\/[^/]+$/ },
  { method: "POST", path: /^\/payment\/(paymentccavenue|responsepayment)$/ },
];

/** A browser's CORS preflight carries no Authorization header by design. */
const isPreflight = (req) => req.method === "OPTIONS";

/* Case-insensitive matching, done by lowering both sides rather than by
   flagging every pattern, so a new entry cannot forget the flag. */
const isPublicPath = (req) => {
  const path = req.path.toLowerCase().replace(/\/+$/, "") || "/";
  return PUBLIC.some(
    (entry) =>
      entry.method === req.method &&
      new RegExp(entry.path.source, "i").test(path)
  );
};

/**
 * The role a token stands for.
 *
 * Admin tokens issued before this change carry an email and a permissions
 * object but no role at all, so every one of them would fail a role check
 * written the obvious way. They are read as "admin" rather than rejected,
 * which keeps anyone signed in at the moment of deploy signed in; new tokens
 * carry the role outright.
 */
const roleOf = (payload) => {
  if (payload && payload.role) return String(payload.role);
  if (payload && payload.email && payload.permissions) return "admin";
  return "client";
};

/**
 * Verifies the bearer token and, optionally, that its role is one of `roles`.
 * With no argument it only asks that the caller is signed in as somebody.
 */
function requireAuth(roles = null) {
  return (req, res, next) => {
    if (isPreflight(req)) return next();

    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized", reason: "No token provided" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET_KEY, { algorithms: ["HS256"] });
    } catch (error) {
      /* Expiry is told apart from a bad token so the frontend can send the
         user back to the login screen rather than show a generic failure. */
      const expired = error.name === "TokenExpiredError";
      return res.status(401).json({
        error: expired ? "Token expired" : "Token invalid",
        expired,
      });
    }

    const role = roleOf(payload);
    if (roles && !roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden", reason: `Role ${role} may not use this route` });
    }

    req.user = { ...payload, role };
    /* What the old middleware set, so handlers reading req.email still work. */
    req.email = payload.email;

    return next();
  };
}

/**
 * The one guard mounted on /api: public routes straight through, everything
 * else signed in.
 */
function gate(req, res, next) {
  if (isPreflight(req) || isPublicPath(req)) return next();
  return requireAuth()(req, res, next);
}

module.exports = { requireAuth, gate, ADMIN_ROLES, PUBLIC, roleOf, isPublicPath };
