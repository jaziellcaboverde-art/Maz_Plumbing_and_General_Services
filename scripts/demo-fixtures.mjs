import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const SEED_TAG = 'maz-workflow-demo-v1';
export const PREFIX = '[DEMO]';
export function fixtureId(key) {
  const hex = createHash('sha256').update(`${SEED_TAG}:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstNames = ['Adrian Miguel', 'Bianca Isabel', 'Carlo Rafael', 'Diana Marie', 'Enrico Luis', 'Francesca Mae', 'Gabriel Paolo', 'Helena Rose', 'Isaac Daniel', 'Jasmine Claire', 'Kevin Angelo', 'Lara Camille', 'Marco Antonio', 'Nina Patricia', 'Oliver James', 'Patricia Anne', 'Ramon Elias', 'Sofia Andrea', 'Tomas Gabriel', 'Valerie Nicole', 'William Jose', 'Yasmin Celeste'];
const surnames = ['Villanueva', 'Mercado', 'Navarro', 'Aguilar', 'Mendoza', 'Salazar', 'Reyes', 'Castillo', 'Soriano', 'Del Rosario', 'Santiago', 'Bautista', 'Ramos', 'Aquino', 'Cruz', 'Garcia', 'Flores', 'Torres', 'Domingo', 'Pascual', 'Rivera', 'Santos'];
export function demoName(index) {
  return { first: firstNames[index % firstNames.length], last: surnames[Math.floor(index / firstNames.length) % surnames.length] };
}
export const phone = index => `+63900${String(index).padStart(7, '0')}`;
export const point = (index = 0) => {
  const angle = index * 2.399963;
  const radius = .006 + (index % 10) * .006;
  return `SRID=4326;POINT(${121.0437 + Math.cos(angle) * radius} ${14.676 + Math.sin(angle) * radius})`;
};
/**
 * @typedef {{key: string, email: string, role: string, first: string, last: string,
 * index: number, category?: string, slot?: number, status?: string, id?: string}} DemoPerson
 */
export function buildPeople(services) {
  const categories = [...new Set(services.map(s => s.category))].sort();
  /** @type {DemoPerson[]} */
  const people = [{ key: 'admin', email: 'maz-demo-admin@example.com', role: 'admin', first: 'Marisol Elena', last: 'Navarro', index: 900 }];
  for (let i = 0; i < 12; i++) people.push({ key: `customer-${i + 1}`, email: `maz-demo-customer-${String(i + 1).padStart(2, '0')}@example.com`, role: 'customer', ...demoName(260 + i), index: 700 + i });
  categories.forEach((category, c) => {
    for (let slot = 0; slot < 10; slot++) {
      const key = `provider-${slug(category)}-${String(slot + 1).padStart(2, '0')}`;
      people.push({ key, email: `maz-demo-${key}@example.com`, role: 'provider', category, slot, status: 'approved', ...demoName(c * 10 + slot), index: c * 10 + slot + 1 });
    }
  });
  for (const [i, status] of ['pending', 'rejected', 'suspended'].entries()) people.push({ key: `applicant-${status}`, email: `maz-demo-applicant-${status}@example.com`, role: status === 'suspended' ? 'provider' : 'customer', category: categories[0], status, ...demoName(240 + i), index: 600 + i });
  return people;
}
export const STAGES = ['draft', 'recommendation', 'inspection', 'offered', 'quote', 'payment-pending', 'payment-rejected', 'payment-failed', 'deposit-paid', 'scheduled', 'in-progress', 'completion-review', 'turnover', 'balance-due', 'completed', 'cancelled', 'refund', 'dispute', 'change-order', 'milestone'];

// A deliberately artificial attachment, rather than a counterfeit ID or receipt.
export function samplePng() {
  const width = 480, height = 160;
  const pixels = Buffer.alloc((width * 3 + 1) * height, 245);
  for (let y = 0; y < height; y++) pixels[y * (width * 3 + 1)] = 0;
  const letters = {
    A:['01110','10001','10001','11111','10001','10001','10001'],
    D:['11110','10001','10001','10001','10001','10001','11110'],
    E:['11111','10000','10000','11110','10000','10000','11111'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
    L:['10000','10000','10000','10000','10000','10000','11111'],
    M:['10001','11011','10101','10101','10001','10001','10001'],
    N:['10001','11001','11001','10101','10011','10011','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],
    P:['11110','10001','10001','11110','10000','10000','10000'],
    S:['01111','10000','10000','01110','00001','00001','11110'],
    T:['11111','00100','00100','00100','00100','00100','00100'],
    V:['10001','10001','10001','10001','10001','01010','00100'],
    Y:['10001','10001','01010','00100','00100','00100','00100'],
  };
  for (const [line, text] of ['SAMPLE ONLY', 'NOT VALID'].entries()) {
    [...text].forEach((char, i) => (letters[char] ?? []).forEach((row, y) => [...row].forEach((on, x) => {
      if (on !== '1') return;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
        const offset = (30 + line * 60 + y * 4 + dy) * (width * 3 + 1) + 1 + (40 + i * 36 + x * 4 + dx) * 3;
        pixels.set([160, 25, 25], offset);
      }
    })));
  }
  function chunk(type, content) {
    const data = Buffer.concat([Buffer.from(type), content]);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const head = Buffer.alloc(4), tail = Buffer.alloc(4);
    head.writeUInt32BE(content.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, data, tail]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
