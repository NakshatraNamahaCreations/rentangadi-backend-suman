/**
 * Paging on the list endpoints.
 *
 * They have always taken ?limit and ?page, but with no ceiling and no way for
 * a caller to know how many there were in total - so the only usable call was
 * "give me everything", and the screens duly asked for it. Two things change
 * here: a limit is capped, and the answer says how many rows exist.
 *
 * The count goes in headers rather than in the body. Wrapping the array in
 * { rows, total } would be tidier and would break every caller - the admin
 * panel, the executive panel and the public site all read these as a bare
 * list - so the shape stays and the metadata rides alongside.
 *
 * This is the half of pagination that belongs to the API. The other half is
 * the screens: a page of rows is only useful once searching, filtering and
 * sorting happen on the server too, because filtering one page of a thousand
 * records in the browser gives a wrong answer rather than a slow one. That is
 * a change to each list screen and wants doing deliberately.
 */

/* High enough that nothing in use today is cut short - the largest collection
   is under two thousand - and low enough that ?limit=100000 can no longer ask
   the database to serialise everything it has. */
const MAX_LIMIT = 1000;

/** limit 0 means "no paging", which is what an absent limit has always meant. */
const readPaging = (req) => {
  const asked = parseInt(req.query.limit, 10) || 0;
  const limit = asked > 0 ? Math.min(asked, MAX_LIMIT) : 0;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  return { limit, page, cappedFrom: asked > MAX_LIMIT ? asked : null };
};

/**
 * Says how many rows there are, which page this is and how big a page was
 * allowed - so a caller can tell a short last page from a truncated one.
 */
const tellPaging = (res, { total, page, limit }) => {
  res.set("X-Total-Count", String(total));
  res.set("X-Page", String(page));
  res.set("X-Limit", String(limit));
};

module.exports = { MAX_LIMIT, readPaging, tellPaging };
