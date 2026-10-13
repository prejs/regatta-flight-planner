const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A new 6-character Crockford base32 seed. Called once when a plan is created;
 * the solver never calls it, so the seed alone reproduces the plan.
 */
export function newSeed(): string {
  // 256 is a multiple of 32, so the low 5 bits of a byte are uniform.
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CROCKFORD[b & 31]).join('');
}
