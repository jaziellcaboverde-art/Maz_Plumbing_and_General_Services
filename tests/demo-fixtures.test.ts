import { expect, test } from 'vitest';
// The fixture generator has no database connection or side effects.
import { buildPeople, fixtureId, samplePng, STAGES } from '../scripts/demo-fixtures.mjs';

test('creates ten unique approved providers per category and covers every service', () => {
  const services = [
    { category: 'Plumbing', name: 'Leak repair' },
    { category: 'Plumbing', name: 'Repiping' },
    { category: 'Electrical', name: 'Wiring' },
  ];
  const people = buildPeople(services);
  expect(people.filter(p => p.status === 'approved')).toHaveLength(20);
  expect(new Set(people.map((p: { email: string }) => p.email)).size).toBe(people.length);
  expect(new Set(people.map((p: { first: string; last: string }) => `${p.first} ${p.last}`)).size).toBe(people.length);
  expect(people.every((p: { email: string }) => p.email.endsWith('@example.com'))).toBe(true);
  for (const service of services) expect(people.filter(p => p.category === service.category && p.status === 'approved')).toHaveLength(10);
});

test('fixture IDs are stable, valid UUIDs and separated across record keys', () => {
  expect(fixtureId('booking:1')).toBe(fixtureId('booking:1'));
  expect(fixtureId('booking:1')).not.toBe(fixtureId('payment:1'));
  expect(fixtureId('booking:1')).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('the full eleven-category roster has 126 distinct fictional identities', () => {
  const services = Array.from({ length: 11 }, (_, i) => ({ category: `Category ${i}`, name: `Service ${i}` }));
  const people = buildPeople(services);
  expect(people).toHaveLength(126);
  expect(new Set(people.map(p => p.email)).size).toBe(126);
  expect(new Set(people.map(p => `${p.first} ${p.last}`)).size).toBe(126);
});

test('sample attachments are PNGs and workflow scenarios cover the main decision points', () => {
  expect(samplePng().subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(STAGES).toEqual(expect.arrayContaining(['recommendation', 'payment-pending', 'in-progress', 'completed', 'refund', 'dispute', 'milestone']));
});
