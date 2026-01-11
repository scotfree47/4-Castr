// add-confidence-scores.js
// Run from: 4castr/src/app/(dashboard)/data/tickers
// Usage: node add-confidence-scores.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'data.json');
const outputPath = path.join(__dirname, 'data.json');

console.log('📊 Adding confidence scores to data.json...');

// Read the data
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Add confidenceScore based on the 'next' value
const updatedData = data.map(ticker => {
  const nextValue = typeof ticker.next === 'string' ? parseInt(ticker.next) : ticker.next;
  
  return {
    ...ticker,
    confidenceScore: nextValue
  };
});

// Write back to data.json
fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2));

console.log(`✅ Updated ${updatedData.length} tickers with confidence scores`);
console.log('📁 Saved to:', outputPath);