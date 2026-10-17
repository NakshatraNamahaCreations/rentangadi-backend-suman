const moment = require("moment");

const parseDate = (dateStr) => {
	// console.log("parse date: ", dateStr)
	// console.log("type of parse date: ", typeof(dateStr))
	if (!dateStr) return null;
	if (!dateStr.includes('-')) return null;

	const [day, month, year] = dateStr.split('-');
	// console.log(`day, month, year: `, day, month, year);
	// console.log(`new Date: `, new Date(`${year}-${month}-${day}`));
	return new Date(`${year}-${month}-${day}`);  // Create a new Date object in 'YYYY-MM-DD' format
}

const compareDates = (dateStr1, dateStr2) => {
	const date1 = moment(dateStr1, "DD-MM-YYYY");
	const date2 = moment(dateStr2, "DD-MM-YYYY");

	return date1.isSameOrAfter(date2); // true if date1 is same or later than date2
};

const dateDiff = (startStr, endStr) => {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end || isNaN(start) || isNaN(end)) return 1;

  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};


module.exports = { parseDate, compareDates, dateDiff };
