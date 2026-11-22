import * as fs from "node:fs";
import * as path from "node:path";
const j = path.join, R = fs.readFileSync, W = fs.writeFileSync;

const A = process.argv.slice(2);
let I = "", O = "";
for (let k = 0; k < A.length; k++) {
  const a = A[k];
  if (a === "--") continue;
  else if (a.startsWith("--input=")) I = a.slice(8);
  else if (a.startsWith("--output=")) O = a.slice(9);
  else if (a === "--input") I = A[++k] || "";
  else if (a === "--output") O = A[++k] || "";
  else if (!I) I = a;
  else if (!O) O = a;
}
const cwd = process.cwd();
const isDir = (c) => { try { return fs.statSync(c).isDirectory(); } catch { return false; } };
if (!I) I = isDir(cwd + "/input") ? cwd + "/input" : isDir("/input") ? "/input" : process.env.MAKEFUN_INPUT_DIR || cwd + "/input";
if (!O) O = isDir(cwd + "/output") ? cwd + "/output" : isDir("/output") ? "/output" : process.env.MAKEFUN_OUTPUT_DIR || cwd + "/output";

function run(prog, inp) {
  const o = new Uint8Array(1 << 16);
  let ol = 0;
  const s = [], c = [], m = new Int32Array(256);
  let pc = 0, steps = 0, ip = 0;
  const fin = (code) => ({ out: o.slice(0, ol), code });
  while (true) {
    if (steps >= 1000000) return fin(10);
    if (pc < 0 || pc >= prog.length) return fin(9);
    const op = prog[pc];
    let len = 1;
    if (op === 1) len = 2;
    else if (op === 2) len = 5;
    else if (op >= 48 && op <= 51) len = 3;
    else if ([0,3,4,5,6,7,52,64,65,80,81,82,83].includes(op)
      || (op >= 16 && op <= 30) || (op >= 32 && op <= 34)) len = 1;
    else return fin(5);
    if (pc + len > prog.length) return fin(9);
    steps++;
    const next = pc + len;
    const off = ((prog[pc + 1] | (prog[pc + 2] << 8)) << 16) >> 16;
    let npc = next;
    switch (op) {
      case 0: return fin(0);
      case 83:
        if (!s.length) return fin(2);
        return fin(s.pop() & 255);
      case 1:
        if (s.length >= 256) return fin(3);
        s.push((prog[pc + 1] << 24) >> 24);
        break;
      case 2:
        if (s.length >= 256) return fin(3);
        s.push(prog.readInt32LE(pc + 1));
        break;
      case 3:
        if (!s.length) return fin(2);
        s.pop();
        break;
      case 4:
        if (!s.length) return fin(2);
        if (s.length >= 256) return fin(3);
        s.push(s[s.length - 1]);
        break;
      case 5: {
        if (s.length < 2) return fin(2);
        const t = s[s.length - 1];
        s[s.length - 1] = s[s.length - 2];
        s[s.length - 2] = t;
        break;
      }
      case 6:
        if (s.length < 2) return fin(2);
        if (s.length >= 256) return fin(3);
        s.push(s[s.length - 2]);
        break;
      case 7: {
        if (s.length < 3) return fin(2);
        const n = s.length;
        const a = s[n - 3], b = s[n - 2], d = s[n - 1];
        s[n - 3] = b; s[n - 2] = d; s[n - 1] = a;
        break;
      }
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 32: case 33: case 34: {
        if (s.length < 2) return fin(2);
        const b = s.pop(), a = s.pop();
        if (op === 16) s.push((a + b) | 0);
        else if (op === 17) s.push((a - b) | 0);
        else if (op === 18) s.push(Math.imul(a, b));
        else if (op === 19) {
          if (b === 0) return fin(4);
          s.push(Math.trunc(a / b) | 0);
        } else if (op === 20) {
          if (b === 0) return fin(4);
          s.push((a % b) | 0);
        } else if (op === 21) {
          if (b === 0) return fin(4);
          s.push(Math.floor((a >>> 0) / (b >>> 0)) | 0);
        } else if (op === 22) {
          if (b === 0) return fin(4);
          s.push(((a >>> 0) % (b >>> 0)) | 0);
        } else if (op === 24) s.push(a & b);
        else if (op === 25) s.push(a | b);
        else if (op === 26) s.push(a ^ b);
        else if (op === 32) s.push(a === b ? 1 : 0);
        else if (op === 33) s.push(a < b ? 1 : 0);
        else s.push((a >>> 0) < (b >>> 0) ? 1 : 0);
        break;
      }
      case 23: case 27:
        if (!s.length) return fin(2);
        s.push(op === 23 ? (-s.pop()) | 0 : ~s.pop());
        break;
      case 28: case 29: case 30: {
        if (s.length < 2) return fin(2);
        const b = s.pop(), a = s.pop(), sh = b & 31;
        if (op === 28) s.push((a << sh) | 0);
        else if (op === 29) s.push(a >> sh);
        else s.push((a >>> sh) | 0);
        break;
      }
      case 48:
        npc = next + off;
        break;
      case 49:
        if (!s.length) return fin(2);
        if (s.pop() === 0) npc = next + off;
        break;
      case 50:
        if (!s.length) return fin(2);
        if (s.pop() !== 0) npc = next + off;
        break;
      case 51:
        if (c.length >= 64) return fin(7);
        c.push(next);
        npc = prog[pc + 1] | (prog[pc + 2] << 8);
        break;
      case 52:
        if (!c.length) return fin(8);
        npc = c.pop();
        break;
      case 64: {
        if (!s.length) return fin(2);
        const addr = s.pop();
        if (addr < 0 || addr > 255) return fin(6);
        s.push(m[addr]);
        break;
      }
      case 65: {
        if (s.length < 2) return fin(2);
        const addr = s.pop(), val = s.pop();
        if (addr < 0 || addr > 255) return fin(6);
        m[addr] = val;
        break;
      }
      case 80: {
        if (!s.length) return fin(2);
        const t = String(s[s.length - 1]);
        if (ol + t.length > 65536) return fin(11);
        s.pop();
        for (let j = 0; j < t.length; j++) o[ol++] = t.charCodeAt(j);
        break;
      }
      case 81: {
        if (!s.length) return fin(2);
        if (ol >= 65536) return fin(11);
        o[ol++] = s.pop() & 255;
        break;
      }
      case 82:
        if (s.length >= 256) return fin(3);
        s.push(ip < inp.length ? inp[ip++] : -1);
        break;
    }
    pc = npc;
  }
}

for (let i = 1; i <= 40; i++) {
  const id = "i" + ("00" + i).slice(-3);
  const r = run(R(j(I, id, "program.bin")), R(j(I, id, "input.bin")));
  const dir = j(O, id);
  fs.mkdirSync(dir, { recursive: true });
  W(j(dir, "stdout.bin"), r.out);
  W(j(dir, "exit.txt"), String(r.code) + "\n");
}
