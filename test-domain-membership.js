"use strict";

const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('app.js', 'utf8');
const context = {
  console,
  window: { addEventListener() {} },
  document: { addEventListener() {} },
  Math: Object.create(Math),
};
context.Math.random = () => 0;
vm.createContext(context);
vm.runInContext(source, context);

const domains = q => Array.from(context.questionDomains(q));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

assert(JSON.stringify(domains(null)) === '[]', 'null question');
assert(JSON.stringify(domains({ domain: 1 })) === '[1]', 'primary domain');
assert(JSON.stringify(domains({ domain: 1, domain2: 4 })) === '[1,4]', 'legacy domain2');
assert(JSON.stringify(domains({ domain: 1, domain2: 4, domains: [2, 3, 6] })) === '[2,3,6]', 'arbitrary three-domain membership');
assert(JSON.stringify(domains({ domains: [2, 3, 6, 2] })) === '[2,3,6]', 'valid arrays deduplicate');
for (const invalid of [null, 7, -1, 1.5, false, ' ', '0x2'])
  assert(JSON.stringify(domains({ domains: [invalid] })) === '[]', `rejects ${String(invalid)}`);

const review = [
  { q: { domains: [1, 4, 6] } },
  { q: { domain: 4 } },
  { q: { domain: 2, domain2: 3 } },
];
assert(review.filter(w => domains(w.q).includes(4)).length === 2, 'review-style membership filter');
assert(JSON.stringify([...new Set(review.flatMap(w => domains(w.q)))].sort()) === '[1,2,3,4,6]', 'review-style present domains');

const sample = context.weightedSample([
  { domain: 1 },
  { domain: 2, domains: [1, 2] },
], 1);
assert(sample.length === 1 && sample[0] === 0, 'weighted sampling uses primary domain only');
console.log('domain membership tests: PASS');