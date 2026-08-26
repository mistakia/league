// Deterministic uniform source, shared by every drawing path in the tree.
//
// Extracted so the season board and the simulation sampler cannot drift onto
// two different generators: a value that is reproducible under one PRNG and not
// the other is worse than one that is reproducible under neither, because the
// disagreement only shows up when someone compares them.
//
// mulberry32: 32-bit state, one multiply-xorshift round, uniform on [0,1). Fast
// enough to sit inside the draw loop and short enough to audit.
export const seeded_random = (seed) => {
  let state = seed
  return () => {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default seeded_random
