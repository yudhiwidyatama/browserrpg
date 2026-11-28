"use strict";
// Replay strings: version, mode, seed and every recorded input. Because the simulation is
// deterministic, replaying the inputs reproduces a run exactly.
//
//   MD<version>:<mode>:<seed base36>:<count>:<payload>:<checksum>
//   payload = entries joined by ";", each "<step delta>,<kind>,<x>,<y>" in base 36

function checksum(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function encode({ version, mode, seed, entries }) {
  let prev = 0;
  const payload = entries
    .map(([step, kind, x, y]) => {
      const delta = step - prev;
      prev = step;
      return [delta, kind, x, y].map((v) => v.toString(36)).join(",");
    })
    .join(";");
  return `MD${version}:${mode}:${(seed >>> 0).toString(36)}:${entries.length}:${payload}:${checksum(payload)}`;
}

function decode(text, version) {
  const parts = String(text || "").trim().split(":");
  if (parts.length !== 6 || !/^MD\d+$/.test(parts[0])) throw new Error("This is not a Missile Defense replay.");
  if (parts[0] !== `MD${version}`) throw new Error("This replay was made with a different version of the game.");
  const [, modeText, seedText, countText, payload, sum] = parts;
  if (checksum(payload) !== sum) throw new Error("This replay is damaged (checksum mismatch).");
  const mode = parseInt(modeText, 10);
  const seed = parseInt(seedText, 36) | 0;
  const count = parseInt(countText, 10);
  if (![0, 1, 2].includes(mode) || !Number.isFinite(count)) throw new Error("This replay has invalid settings.");
  let step = 0;
  const entries = payload
    ? payload.split(";").map((chunk) => {
        const v = chunk.split(",").map((s) => parseInt(s, 36));
        if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) throw new Error("This replay contains an invalid input.");
        step += v[0];
        return [step, v[1], v[2], v[3]];
      })
    : [];
  if (entries.length !== count) throw new Error("This replay is incomplete.");
  return { mode, seed, entries };
}

/** Short code for sharing a daily result. Assisted runs get none, so codes compare fairly. */
function shareCode({ date, score, replay, assisted }) {
  if (assisted) return null;
  return `MDD-${date}-${score}-${checksum(replay).toUpperCase().slice(0, 6)}`;
}

function utcDateNumber(now = new Date()) {
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

module.exports = { encode, decode, shareCode, utcDateNumber, checksum };
