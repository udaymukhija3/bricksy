// Run with: npm test — the daily calendar: day numbers, archive dates, and their round trip.
import { today, dayNumber, dateOfDay, EPOCH } from './run.ts';

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };

const d1 = new Date(2026, 8, 18, 12); // local noon on launch day
check('2026-09-18 is daily #1', dayNumber(d1) === 1);
check('EPOCH is 2026-09-18 UTC', new Date(EPOCH).toISOString().startsWith('2026-09-18'));
const d10 = new Date(2026, 8, 27, 23, 59);
check('2026-09-27 (23:59 local) is daily #10', dayNumber(d10) === 10);
check('dateOfDay(1) from day 10 is the launch date', dateOfDay(1, d10) === '2026-09-18');
check('dateOfDay(7) from day 10 is 2026-09-24', dateOfDay(7, d10) === '2026-09-24');
// Round trip across a month boundary and DST-ish dates.
let bad = 0;
for (let n = 1; n <= 400; n++) { const now = new Date(2027, 2, 5, 9); const s = dateOfDay(n, now); const [y, m, d] = s.split('-').map(Number); if (dayNumber(new Date(y, m - 1, d, 12)) !== n) bad++; }
check(`dayNumber(dateOfDay(n)) === n for 400 days (${bad} bad)`, bad === 0);
check('today() is local YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(today()) && today(new Date(2026, 0, 5)) === '2026-01-05');
if (failures) throw new Error(`${failures} check(s) failed`);
