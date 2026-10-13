import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_ORDER } from '../solver/model';
import { decodePlanUrl, encodePlanUrl, PLAN_LAYER_BUDGET, toPlanInput, type PlanUrl } from './url';

const SKETCH = '0.t17b7.f9-15.oOGBRK.K7QX2M.d7-6.s3-7-9.x2-12.a1~c0123456~nabc_-';

test('decodes the spec sketch', () => {
  const { plan, labels } = decodePlanUrl(`#${SKETCH}`);
  assert.deepEqual(plan, {
    version: '0',
    teams: 17,
    boats: 7,
    activeBoats: 6,
    minFlights: 9,
    maxFlights: 15,
    order: DEFAULT_ORDER,
    seed: 'K7QX2M',
    idleBoatOnWater: true,
    events: [
      { type: 'drop', team: 6, from: 5 },
      { type: 'substitute', boat: 2, spare: 6, from: 8 },
      { type: 'remove', boat: 1, from: 11 },
      { type: 'extra', count: 1 },
    ],
  });
  assert.deepEqual(labels, { c: '0123456', n: 'abc_-' });
});

test('encode and decode round-trip', () => {
  assert.equal(encodePlanUrl(decodePlanUrl(SKETCH)), SKETCH);
  const dock = '0.t11b6.f6-7.oOBRK.0000A0.i';
  assert.equal(decodePlanUrl(dock).plan.idleBoatOnWater, false);
  assert.equal(encodePlanUrl(decodePlanUrl(dock)), dock);
});

test('active boats are written only when they differ from the largest race size', () => {
  const { plan } = decodePlanUrl('0.t17b7a6.f9-15.oOGBRK.K7QX2M');
  assert.equal(plan.activeBoats, 6);
  assert.equal(encodePlanUrl({ plan, labels: {} }), '0.t17b7.f9-15.oOGBRK.K7QX2M');
  const noSpare = '0.t17b7a7.f9-15.oOGBRK.K7QX2M';
  assert.equal(decodePlanUrl(noSpare).plan.activeBoats, 7);
  assert.equal(encodePlanUrl(decodePlanUrl(noSpare)), noSpare);
});

test('maps to solver input with the version parameters', () => {
  const input = toPlanInput(decodePlanUrl(SKETCH).plan);
  assert.equal(input.iterations, 1_000_000);
  assert.equal(input.seed, 'K7QX2M');
  assert.deepEqual(input.order, DEFAULT_ORDER);
});

test('rejects invalid links', () => {
  const bad = [
    '1.t17b7a6.f9-15.oOGBR.K7QX2M', // unknown version
    '0.t17b7a5.f9-15.oOGBR.K7QX2M', // fewer active boats than the largest race
    '0.t17b7a8.f9-15.oOGBR.K7QX2M', // more active boats than boats
    '0.t17b17.f9-15.oOGBR.K7QX2M', // more boats than palette colours
    '0.t017b7.f9-15.oOGBR.K7QX2M', // leading zero
    '0.t17b7.f15-9.oOGBR.K7QX2M', // min above max
    '0.t17b7.f9-65.oOGBR.K7QX2M', // more than 64 flights
    '0.t17b7.f9-63.oOGBR.K7QX2M.a2', // more than 64 flights with extras
    '0.t17b7.f9-15.oOGGR.K7QX2M', // repeated objective
    '0.t17b7.f9-15.oOGBX.K7QX2M', // unknown objective
    '0.t17b7.f9-15.oOGBR.K7QX2I', // I is not Crockford
    '0.t17b7.f9-15.oOGBR.k7qx2m', // seeds are upper case
    '0.t17b7.f9-15.oOGBR', // no seed
    '0.t17b7.f9-15.oOGBR.K7QX2M.d18-6', // no team 18
    '0.t17b7.f9-15.oOGBR.K7QX2M.d7-0', // flights count from 1
    '0.t17b7.f9-15.oOGBR.K7QX2M.x3-65', // no flight 65
    '0.t17b7.f9-15.oOGBR.K7QX2M.s3-3-9', // boat replaces itself
    '0.t17b7.f9-15.oOGBR.K7QX2M.d7-6.i', // flag after events
    '0.t17b7.f9-15.oOGBR.K7QX2M.q1', // unknown token
    '0.t17b7.f9-15.oOGBR.K7QX2M~c1~c2', // label layer twice
    '0.t17b7.f9-15.oOGBR.K7QX2M~Cx', // label key must be lower case
    '0.t17b7.f9-15.oOGBR.K7QX2M/', // not URL safe
  ];
  for (const link of bad) assert.throws(() => decodePlanUrl(link), Error, link);
});

test('encode rejects an invalid plan', () => {
  const ok = decodePlanUrl(SKETCH);
  const broken: PlanUrl = { ...ok, plan: { ...ok.plan, seed: 'K7QX2' } };
  assert.throws(() => encodePlanUrl(broken));
  assert.throws(() => encodePlanUrl({ ...ok, labels: { c: 'a~b' } }));
});

test('a busy plan layer stays within the QR budget', () => {
  const events = Array.from({ length: 6 }, (_, i) => `d${24 - i}-${10 + i}`).join('.');
  const link = `0.t24b16a14.f12-18.oOGBRK.K7QX2M.i.${events}.s12-14-13.s11-15-14.x10-16.a3`;
  assert.equal(encodePlanUrl(decodePlanUrl(link)), link);
  assert.ok(link.length <= PLAN_LAYER_BUDGET, `${link.length} characters`);
});
