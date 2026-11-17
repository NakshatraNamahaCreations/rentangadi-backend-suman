/**
 * Narrowing a list to one calendar month.
 *
 * The calendars send ?month=2026-11 and always have; the server simply never
 * read it, so every month showed the same 1,800 records and the cards under a
 * heading saying "November 2026" counted all time.
 *
 * Reading it is awkward because these dates are strings, not dates: almost
 * all of them are DD-MM-YYYY, and a handful - 18 enquiries at the time of
 * writing - are YYYY-MM-DD. A range query cannot be written against either,
 * so the month is matched at both ends of the string, and both spellings are
 * accepted. Neither can use an index, but these are collections of one to two
 * thousand documents and the scan costs a few milliseconds.
 *
 * Storing a real Date alongside would make this a range query and let an
 * index serve it. That is a migration over live data and belongs with the
 * other backfill work, not here.
 */

/**
 * @param {string} field   the document field holding the date string
 * @param {string} month   "YYYY-MM"
 * @returns a Mongo filter, or null when month is absent or malformed - in
 *          which case the caller should not filter at all rather than return
 *          nothing, so a typo in a URL does not read as "no records".
 */
const monthFilter = (field, month) => {
  const parsed = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ""));
  if (!parsed) return null;

  const [, year, mm] = parsed;

  return {
    $or: [
      /* DD-MM-YYYY */
      { [field]: { $regex: `-${mm}-${year}$` } },
      /* YYYY-MM-DD */
      { [field]: { $regex: `^${year}-${mm}` } },
    ],
  };
};

/**
 * The same test, for rows already in hand.
 *
 * These lists are kept in memory and refreshed in the background, so a month
 * can be answered by narrowing that copy instead of asking Mongo again. The
 * query above cannot use an index - a regex anchored at the end of a string
 * never can - and measured about 1.3 seconds against Atlas, where filtering
 * the cached copy takes about a millisecond and is no staler than the list
 * screens already are.
 *
 * It is written here, beside the query it has to agree with, because two
 * definitions of "is this row in November" in two files is exactly the kind
 * of pair that drifts.
 *
 * @returns a predicate, or null for an absent or malformed month - matching
 *          monthFilter, so a caller can treat both the same way.
 */
const monthMatcher = (field, month) => {
  const parsed = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ""));
  if (!parsed) return null;

  const [, year, mm] = parsed;
  const ddmmyyyy = new RegExp(`-${mm}-${year}$`);
  const yyyymmdd = new RegExp(`^${year}-${mm}`);

  return (row) => {
    const value = String((row && row[field]) || "");
    return ddmmyyyy.test(value) || yyyymmdd.test(value);
  };
};

module.exports = monthFilter;
module.exports.monthMatcher = monthMatcher;
