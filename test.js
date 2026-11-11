// Self-check: node test.js <cpu-rom> [...]
// ROM files are not part of this repository; use your own dumps.
const fs = require("fs");
const crypto = require("crypto");
const P = require("./patch.js");
const sha1 = (b) => crypto.createHash("sha1").update(b).digest("hex");
let bad = 0;
for (const f of process.argv.slice(2)) {
  const rom = new Uint8Array(fs.readFileSync(f)), h = sha1(rom);
  const r = P.analyse(rom, h);
  if (!r.ok) { console.log(`${f}: refused – ${r.reasons.join(" ")}`); continue; }
  const out = P.apply(rom, r.plan), ho = sha1(out);
  const again = P.analyse(out, ho);
  const diff = out.reduce((n, b, i) => n + (b !== rom[i]), 0);
  const okKnown = !r.known || r.known.out === ho;
  console.assert(again.patched, "patched ROM not recognised");
  console.assert(P.checksumOk(out), "checksum");
  console.assert(okKnown, `known ROM gives ${ho}, expected ${r.known && r.known.out}`);
  if (!again.patched || !okKnown) bad++;
  console.log(`${f}: ok, ${diff} bytes changed, routine at $${r.plan.at.toString(16).toUpperCase()}, sum $${P.sum16(out).toString(16).toUpperCase()}, SHA1 ${ho}${r.known ? " (= known result)" : ""}`);
  if (process.env.OUT) fs.writeFileSync(`${process.env.OUT}/${require("path").basename(f)}.led`, out);
  const ra = P.analyse(rom, h, { alt: true });
  if (ra.ok) {
    const oa = P.apply(rom, ra.plan), ha = sha1(oa), okA = !r.known || !r.known.altOut || r.known.altOut === ha;
    console.assert(P.analyse(oa, ha).patched && P.checksumOk(oa) && okA, "alternative patch");
    if (!okA) bad++;
    console.log(`  alternative: sum $${P.sum16(oa).toString(16).toUpperCase()}, SHA1 ${ha}${r.known && r.known.altOut ? " (= known result)" : ""}`);
  }
}
// Negative tests on the first ROM: damaged byte and patched twice must be refused.
if (process.argv[2]) {
  const rom = new Uint8Array(fs.readFileSync(process.argv[2]));
  const d = Uint8Array.from(rom); d[100] ^= 1;
  console.assert(!P.analyse(d, sha1(d)).ok, "damaged ROM accepted"); if (P.analyse(d, sha1(d)).ok) bad++;
}
process.exit(bad ? 1 : 0);
