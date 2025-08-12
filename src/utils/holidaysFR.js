// Minimal holidays provider for France using date-holidays
// Returns a Set of ISO dates "YYYY-MM-DD" for the given year(s)

import Holidays from 'date-holidays';

export function getFrenchHolidaySet(years = [new Date().getFullYear(), new Date().getFullYear() + 1]) {
  const hd = new Holidays('FR');
  const out = new Set();
  years.forEach(y => {
    const list = hd.getHolidays(y) || [];
    list.forEach(h => {
      const d = new Date(h.date);
      d.setHours(0,0,0,0);
      const iso = d.toISOString().slice(0,10);
      out.add(iso);
    });
  });
  return out;
}
