const NodeCache = require("node-cache");

/**
 * In-memory cache for the three big list endpoints.
 *
 * Those lists read 1,000-1,500 documents out of Atlas, which costs about four
 * seconds however little is sent back. The documents change rarely compared to
 * how often the screens are opened, so the result is held in memory and the
 * slow read is moved off the request path by a background refresh.
 *
 * Only the default call is cached — no ?limit, ?page or ?full — because the
 * paginated calls already answer in around a tenth of a second.
 */

/* The refresh runs every two minutes; the entry outlives it so the cache never
   goes cold between refreshes. */
const REFRESH_MS = 120 * 1000;
const cache = new NodeCache({ stdTTL: 400, checkperiod: 60 });

const KEYS = {
  enquiries: "list:enquiries",
  orders: "list:orders",
  quotations: "list:quotations",
  clients: "list:clients",
  products: "list:products",
};

const get = (key) => cache.get(key);
const set = (key, value) => cache.set(key, value);
const invalidate = (key) => cache.del(key);

/* OPTIONS and HEAD change nothing; OPTIONS in particular is the CORS
   preflight, which would otherwise drop the cache before every write. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Express middleware. A write on this router means the collection may have
 * changed, so the cached list is dropped once the response is on its way.
 * Hooking the router rather than each handler means new mutations are covered
 * without having to remember this file.
 */
const invalidateOn = (key) => (req, res, next) => {
  if (WRITE_METHODS.has(req.method)) {
    res.on("finish", () => cache.del(key));
  }
  next();
};

/* Populated by index.js so this module does not have to know the models. */
const loaders = new Map();

const register = (key, loader) => loaders.set(key, loader);

const refreshAll = async (label) => {
  for (const [key, loader] of loaders) {
    try {
      const started = Date.now();
      const data = await loader();
      /* An empty result almost always means the loader is querying the wrong
         place; caching it would hide every row for the whole TTL. */
      if (Array.isArray(data) && data.length === 0) {
        console.error(`[listCache] ${key}: loader returned 0 rows, not caching`);
        continue;
      }
      cache.set(key, data);
      console.log(
        `[listCache] ${label} ${key}: ${Array.isArray(data) ? data.length : "?"} rows in ${Date.now() - started}ms`
      );
    } catch (err) {
      console.error(`[listCache] ${key} refresh failed:`, err.message);
    }
  }
};

/* Warms every list on boot, then keeps them warm. */
const start = () => {
  refreshAll("warm");
  const timer = setInterval(() => refreshAll("refresh"), REFRESH_MS);
  if (timer.unref) timer.unref();
};

module.exports = { KEYS, get, set, invalidate, invalidateOn, register, start };
