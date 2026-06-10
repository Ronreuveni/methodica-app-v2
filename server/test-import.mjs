// Dev utility: import the legacy workbook from disk and print a digest.
//   node --experimental-sqlite server/test-import.mjs "C:\path\to\הפקות דיגיטל.xlsx"
import { readFileSync } from 'node:fs';
import { importWorkbook } from './importExcel.mjs';
import { db } from './db.mjs';

const path = process.argv[2] || 'C:/Users/user/Downloads/הפקות דיגיטל.xlsx';
const res = importWorkbook(readFileSync(path), { mode: 'replace' });
console.log('imported:', JSON.stringify(res.imported));
console.log('warnings:', JSON.stringify(res.warnings));
console.log('CORE:', db.prepare('select name from producers where is_external=0 order by sort_index').all().map(p => p.name).join(' | '));
console.log('EXT:', db.prepare('select name from producers where is_external=1 order by sort_index').all().map(p => p.name).join(' | '));
console.log('status dist:', JSON.stringify(db.prepare('select status, count(*) n from projects group by status').all()));
for (const row of db.prepare("select name, client, status, due_date, producers from projects where status != 'done' limit 5").all()) {
  console.log('proj:', JSON.stringify(row));
}
for (const row of db.prepare('select producer_id, month_label, name, status, due from producer_tasks limit 3').all()) {
  console.log('task:', JSON.stringify(row));
}
console.log('assignments per year:', JSON.stringify(db.prepare("select substr(date,1,4) y, count(*) n from assignments group by y").all()));
