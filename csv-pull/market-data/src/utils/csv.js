import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";

export function writeCSV(filePath, rows) {
  if (!rows || rows.length === 0) return;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const csv = stringify(rows, {
    header: true,
    columns: ["date", "open", "high", "low", "close", "volume"]
  });

  fs.writeFileSync(filePath, csv);
}