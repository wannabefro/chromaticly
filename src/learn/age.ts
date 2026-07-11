// Pure under-13 helper (KTD4). Core stays free of `Date` calls for
// determinism/testability — the caller injects the current year at the screen
// edge. This is a birth-year-only approximation (A11, product-accepted for this
// slice): a user who is still 12 but has already had a birthday this calendar
// year would pass as "not under 13" a few months early. Full DOB precision is
// deferred.
export function isUnderThirteen(birthYear: number, currentYear: number): boolean {
  return currentYear - birthYear < 13;
}
