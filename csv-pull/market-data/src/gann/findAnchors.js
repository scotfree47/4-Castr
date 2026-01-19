import fs from "fs";
import { GANN_DATES } from "../config/gannDates.js";

export function findAnchors(csvPath) {
  const rows = fs.readFileSync(csvPath, "utf8")
    .split("\n")
    .slice(1)
    .map(r => r.split(","));

  const anchors = [];

  for (const [date, , , , close] of rows) {
    const md = date.slice(5);
    if (GANN_DATES.highs.includes(md)) {
      anchors.push({ date, type: "HIGH", price: close });
    }
    if (GANN_DATES.lows.includes(md)) {
      anchors.push({ date, type: "LOW", price: close });
    }
  }

  return anchors;
}