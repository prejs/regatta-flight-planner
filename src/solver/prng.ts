// Seeded integer PRNG (sfc32). Never use Math.random in the solver: the same
// seed has to give the same plan on every device.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Decodes a Crockford base32 seed such as "K7QX2M" into an integer. */
export function seedToInt(seed: string): number {
  let n = 0;
  for (const ch of seed.toUpperCase()) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) throw new Error(`Invalid seed character "${ch}" (Crockford base32 expected)`);
    n = (Math.imul(n, 32) + v) >>> 0;
  }
  return n;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    // splitmix32 expands one integer into the four sfc32 state words.
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    for (let i = 0; i < 12; i++) this.u32();
  }

  u32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return this.u32() % n;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
