"use strict";

const assert = require("assert");
const crypto = require("crypto");
global.window = {};
require("./data.js");
const data = window.EXAM_DATA;
const expectedAdditions = {24:[6],41:[1],45:[3],50:[4],52:[1],58:[5],69:[5],78:[1,4],80:[4],85:[3,1],89:[3],95:[1,4],178:[1],201:[3],214:[4],215:[1],218:[2],251:[5],272:[3]};
const expectedRecommendations = {58:[1,5,3,6],78:[6,1,4],85:[5,3,1],95:[6,1,4],193:[3,2,5],251:[3,6,5],275:[6,4,5]};
const names = {1:"Cloud Architecture",2:"Deployment",3:"Operations",4:"Security",5:"DevOps Fundamentals",6:"Troubleshooting"};
const byNumber = new Map(data.map(q => [q.number, q]));
const contentHash = crypto.createHash("sha256").update(JSON.stringify(data.map(q => [q.number,q.stem,q.options,q.answer,q.choose,q.explanations,q.deepdive]))).digest("hex");

assert.strictEqual(data.length, 311);
assert.deepStrictEqual(Array.from({length:314},(_,i)=>i+1).filter(n=>!byNumber.has(n)), [73,74,148]);
for (const q of data) {
  assert.strictEqual(q.domainName, names[q.domain], `Q${q.number} primary`);
  assert.ok(Number.isInteger(q.domain) && names[q.domain], `Q${q.number} valid primary`);
  const domains = q.domains || [q.domain];
  assert.strictEqual(domains[0], q.domain, `Q${q.number} domains starts primary`);
  assert.strictEqual(new Set(domains).size, domains.length, `Q${q.number} domains unique`);
  assert.ok(domains.every(d => names[d]), `Q${q.number} domains valid`);
  if (q.domain2 != null) {
    assert.strictEqual(domains[1], q.domain2, `Q${q.number} legacy domain2 second`);
    assert.strictEqual(q.domainName2 || q.domain2Name, names[q.domain2], `Q${q.number} legacy name`);
  }
}
assert.deepStrictEqual(byNumber.get(95).domains, [6,1,4]);
assert.deepStrictEqual(byNumber.get(58).domains, [1,5,3,6]);
assert.deepStrictEqual(byNumber.get(262).domains || [byNumber.get(262).domain], [4]);
assert.strictEqual(byNumber.get(262).domain2, undefined);
for (const [number, additions] of Object.entries(expectedAdditions))
  for (const domain of additions)
    assert.ok(byNumber.get(Number(number)).domains.includes(domain), `Q${number} audit addition ${domain}`);
for (const [number, domains] of Object.entries(expectedRecommendations))
  assert.deepStrictEqual(byNumber.get(Number(number)).domains, domains, `Q${number} full recommendation`);
assert.strictEqual(contentHash, "646d80dafdb4bb672bf35fb76352ecb159bde9972e95e2a5331d905de20439bf", "question content unchanged");
console.log(`domain data tests: PASS (${data.length} entries, ${data.filter(q=>q.domains).length} multi-domain, content ${contentHash})`);
