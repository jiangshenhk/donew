import { execSync } from 'child_process';

const type = process.argv[2] || 'evening';

if (!['morning','evening'].includes(type)) {
  throw new Error('Usage: node scripts/test-market-daily-report.mjs morning|evening');
}

console.log(`Testing ${type} report generation...`);

execSync(`node scripts/generate-market-daily-report.mjs ${type}`, {
  stdio: 'inherit'
});

const file = type === 'morning'
  ? 'docs/市场/每日市场早报.md'
  : 'docs/市场/每日市场晚报.md';

console.log(`Running validator on ${file}`);

execSync(`node scripts/validate-market-report.mjs "${file}"`, {
  stdio: 'inherit'
});

console.log('Test completed successfully');
