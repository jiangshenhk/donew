import fs from 'fs';
import { validateCriticalRequirements, sanitizeReport } from '../lib/market-report-core.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node validate-market-report.mjs <markdown-file>');

const text = fs.readFileSync(file, 'utf8');
const cleaned = sanitizeReport(text);
validateCriticalRequirements(cleaned);
console.log('Market report validation passed with shared critical requirements');
