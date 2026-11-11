// LED ghosting patch for Stern Whitestar CPU ROMs (MC6809, 128 KB).
// Runs in the browser and in Node. Contains no bytes of any original ROM:
// it searches the user's ROM for the lamp matrix driver and writes our own code.
// MIT License with attribution requirement, see LICENSE.
// Original: https://github.com/druckgott/whitestar-led-ghosting-patch
(function (root) {
  "use strict";

  const SIZE = 0x20000;          // 128 KB CPU ROM
  const FIXED = 0x18000;         // file offset of CPU address $8000
  const CK = 0x1FFED;            // Stern checksum: $FFED balance byte, $FFEE/$FFEF 16-bit sum
  const cpu = (off) => off - FIXED + 0x8000;
  const off = (adr) => adr - 0x8000 + FIXED;

  // ROMs we have checked. "device" = burned and measured on a real machine, "emulator" = same lamp output
  // as the original in MAME, patch not yet run on a real machine. Key = SHA1 of the original CPU ROM.
  const KNOWN = {
    "f3baaaa1b9f12a98109da55746031eb9f5f8790c": { name: "The Simpsons Pinball Party CPU 5.00", at: 0xFEA9, out: "24d2562c6250c6234fa3ff0675290986fc064495", status: "device" },
    "573b20cac205b7989cdefceb2c31cb7d88c2951a": { name: "The Simpsons Pinball Party CPU 4.00", out: "8f9975559192311e053bf738237d060703faffdd", status: "emulator" },
    "12875c845c12b6676aa0af7c717fdf074156d938": { name: "The Simpsons Pinball Party CPU 3.00", out: "c19e2b44e0122837ede484fa6603dadfc68900a5", status: "emulator" },
    "78d793cecbc6561a891ff8007f33c63ec5515e9f": { name: "The Simpsons Pinball Party CPU 2.04", out: "7e34288aa07ba76a4fd61ccb60f7f53c6bb7bf06", status: "emulator" },
    "bd6fd25e17cee40d6bb842367b1ce922bbd46003": { name: "The Lord of the Rings CPU 8.00", out: "85b466d3bcf502ecf0600e37c2fda5e622c533b2", status: "emulator" },
    "2aab64eee57e9569c3cc1bde28cda69ff4cacc69": { name: "Playboy CPU 5.00", out: "b394296977983a0ec401cd574f54758052878488", status: "emulator" },
  };
  const MARGIN = 16;             // unknown ROMs: keep 16 fill bytes after the last used byte

  // Our new output routine. TT TT = row table, DP = scratch byte of the driver.
  //   ldx #TABLE ; <load column and row> ; abx ; sta $200A ; bne on
  //   tstb ; bne ret ; lda #1 ; sta $2008 ; stb $2008 ; ret: rts      (empty row: 2.5 us pulse on row 1 only)
  //   on: ldd ,x ; std $2008 ; rts
  const TAIL = [0x3A, 0xB7, 0x20, 0x0A, 0x26, 0x0C, 0x5D, 0x26, 0x08, 0x86, 0x01, 0xB7, 0x20, 0x08, 0xF7, 0x20, 0x08, 0x39,
    0xEC, 0x84, 0xFD, 0x20, 0x08, 0x39];

  // Search patterns (-1 = any byte): the two places where any program must write the lamp ports
  // $2008/$200A of the Whitestar I/O board. Short, fixed by the hardware addresses.
  const SIG_CLEAR = [0xCC, 0x00, 0x00, 0xB7, 0x20, 0x0A, 0xFD, 0x20, 0x08];
  // Output step, two variants: at the end of the driver (jmp) or inside it (jsr).
  const SHAPES = [
    { sig: [0xDC, -1, 0xB7, 0x20, 0x0A, 0x8E, -1, -1, 0xEC, 0x85, 0xFD, 0x20, 0x08, 0x39], dp: 1, tab: 6, call: 0x7E,
      head: (dp) => [0xDC, dp] },
    { sig: [0xB7, 0x20, 0x0A, 0xD6, -1, 0x58, 0x8E, -1, -1, 0xEC, 0x85, 0xFD, 0x20, 0x08, 0x96, -1, 0x4C, 0x81, 0x0A, 0x25, -1, 0x4F, 0x7C],
      dp: 4, tab: 7, call: 0xBD, head: (dp) => [0xD6, dp, 0x58] },
  ];
  const OUT_LEN = 14;            // bytes of the output step we overwrite (both shapes)
  const routine = (s, tab, dp) => [0x8E, tab >> 8, tab & 0xFF, ...s.head(dp), ...TAIL];
  const DONE = SHAPES.map((s) => [...s.head(-1), ...TAIL.slice(0, 11)]);   // start of our routine = already patched

  function find(rom, pat, from = 0, to = rom.length) {
    const hits = [];
    outer: for (let i = from; i <= to - pat.length; i++) {
      for (let j = 0; j < pat.length; j++) if (pat[j] >= 0 && rom[i + j] !== pat[j]) continue outer;
      hits.push(i);
    }
    return hits;
  }

  const sum16 = (rom) => { let s = 0; for (const b of rom) s += b; return s & 0xFFFF; };
  const checksumOk = (rom) => { const s = sum16(rom); return (s & 0xFF) === 0xFF && s === ((rom[CK + 1] << 8) | rom[CK + 2]); };

  // MC6809 instruction length at file offset i.
  function len(rom, i) {
    const idx = (pb) => 1 + (pb & 0x80 ? ({ 8: 1, 9: 2, 12: 1, 13: 2, 15: 2 }[pb & 15] || 0) : 0);
    let op = rom[i], pre = 0;
    if (op === 0x10 || op === 0x11) { pre = 1; op = rom[i + 1]; }
    const p = i + 1 + pre;
    if (pre && op >= 0x20 && op <= 0x2F) return 4;                                          // long branch
    if (op < 0x10) return 2 + pre;
    if (op < 0x20) return pre + ({ 0x16: 3, 0x17: 3, 0x1A: 2, 0x1C: 2, 0x1E: 2, 0x1F: 2 }[op] || 1);
    if (op < 0x30) return 2;
    if (op < 0x34) return 1 + idx(rom[p]);
    if (op < 0x38 || op === 0x3C) return 2;
    if (op < 0x60) return 1 + pre;
    if (op < 0x70) return 1 + idx(rom[p]);
    if (op < 0x80) return 3;
    const wide = [0x83, 0x8C, 0x8E, 0xC3, 0xCC, 0xCE].includes(op);
    switch ((op >> 4) & 3) {
      case 0: return 1 + pre + (wide ? 2 : 1);
      case 1: return 2 + pre;
      case 2: return 1 + pre + idx(rom[p]);
      default: return 3 + pre;
    }
  }

  // Branch/jump target of the instruction at file offset i (CPU address) or null.
  function target(rom, i) {
    const op = rom[i], here = cpu(i);
    if ((op >= 0x20 && op <= 0x2F) || op === 0x8D) return (here + 2 + ((rom[i + 1] << 24) >> 24)) & 0xFFFF;
    if (op === 0x16 || op === 0x17) return (here + 3 + ((rom[i + 1] << 8) | rom[i + 2])) & 0xFFFF;
    if (op === 0x10 && rom[i + 1] >= 0x20 && rom[i + 1] <= 0x2F) return (here + 4 + ((rom[i + 2] << 8) | rom[i + 3])) & 0xFFFF;
    if (op === 0x7E || op === 0xBD) return (rom[i + 1] << 8) | rom[i + 2];
    return null;
  }

  // Can control reach the bytes we overwrite other than by falling through from the instruction before?
  // - no branch near the driver may target them,
  // - no jmp/jsr anywhere in the ROM may target them.
  // Over-cautious on purpose: a false alarm only means we refuse to patch.
  function jumpsInto(rom, A, B, ranges) {
    const hit = (t) => t !== null && ranges.some(([lo, hi]) => t >= cpu(lo) && t < cpu(hi));
    const hits = new Set();
    const scan = (from, to) => { let i = from; for (; i < to; i += len(rom, i)) if (hit(target(rom, i))) hits.add(i); return i; };
    for (let s = A - 0x90; s < A; s++) { const h = new Set(hits); if (scan(s, A) !== A) { hits.clear(); h.forEach((x) => hits.add(x)); } }
    scan(A, B + OUT_LEN + 0x90);
    for (let i = 0; i < rom.length - 2; i++) if ((rom[i] === 0x7E || rom[i] === 0xBD) && hit((rom[i + 1] << 8) | rom[i + 2])) hits.add(i);
    return [...hits];
  }

  // Analyse a ROM. Returns {ok, patched, reasons[], plan} without changing anything.
  function analyse(rom, sha1) {
    const r = { ok: false, patched: false, known: KNOWN[sha1] || null, reasons: [] };
    const fail = (m) => { r.reasons.push(m); return r; };
    if (rom.length !== SIZE) return fail(`File size is ${rom.length} bytes, a Whitestar CPU ROM has 131072.`);
    if (!checksumOk(rom)) return fail("Stern checksum does not match: file is damaged, not a Whitestar CPU ROM, or already modified.");
    if (DONE.some((d) => find(rom, d, FIXED).length)) { r.patched = true; return fail("This ROM already contains the LED patch."); }
    const a = find(rom, SIG_CLEAR, FIXED);
    const b = SHAPES.flatMap((shape) => find(rom, shape.sig, FIXED).map((at) => ({ shape, at })));
    if (a.length !== 1) return fail(`Lamp driver "clear" step found ${a.length} times (need exactly 1).`);
    if (b.length !== 1) return fail(`Lamp driver "output" step found ${b.length} times (need exactly 1).`);
    const A = a[0], B = b[0].at, shape = b[0].shape;
    if (!(B > A && B - A < 0x200)) return fail("The two driver steps are not in one routine.");
    const tab = (rom[B + shape.tab] << 8) | rom[B + shape.tab + 1], dp = rom[B + shape.dp];
    if (tab < 0x8000 || [0, 1, 2, 3, 4, 5, 6, 7].some((i) => rom[off(tab) + 2 * i] !== (1 << i) || rom[off(tab) + 2 * i + 1] !== 0))
      return fail("Row table does not have the expected layout (row 1 = driver output 0).");
    const into = jumpsInto(rom, A, B, [[A + 3, A + 6], [B + 1, B + OUT_LEN]]);
    if (into.length) return fail(`Something may jump into the driver code (at file offset ${into.map((x) => x.toString(16)).join(", ")}).`);
    let end = CK; while (rom[end - 1] === 0xFF) end--;                                   // trailing $FF fill before $FFED
    const code = routine(shape, tab, dp);
    const at = r.known && r.known.at ? r.known.at : cpu(end) + MARGIN;
    if (cpu(end) > at) return fail("Free space differs from the known ROM.");
    if (off(at) + code.length > CK - 4) return fail("Not enough free space at the end of the ROM.");
    r.plan = { clear: A, out: B, call: shape.call, tab, dp, at, code };
    r.ok = true;
    return r;
  }

  // Apply the plan. Returns a new Uint8Array; the input stays unchanged.
  function apply(rom, plan) {
    const o = Uint8Array.from(rom);
    o.set([0x12, 0x12, 0x12], plan.clear + 3);                                            // keep old column data (was: clear it)
    o.set([plan.call, plan.at >> 8, plan.at & 0xFF].concat(Array(OUT_LEN - 3).fill(0x12)), plan.out);  // jmp/jsr to new routine
    o.set(plan.code, off(plan.at));
    // Stern checksum: 8-bit sum $FF via balance byte $FFED, word $FFEE = 16-bit sum.
    let s0 = 0; for (let i = 0; i < o.length; i++) if (i < CK || i > CK + 2) s0 += o[i];
    for (let hi = 0; hi < 256; hi++) {
      const c = (255 * hi - s0) & 0xFFFF;
      if (c < 256) { o[CK] = c; o[CK + 1] = hi; o[CK + 2] = 0xFF; break; }
    }
    if (!checksumOk(o)) throw new Error("checksum balance failed");
    return o;
  }

  const api = { analyse, apply, checksumOk, sum16, KNOWN };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LedPatch = api;
})(this);
