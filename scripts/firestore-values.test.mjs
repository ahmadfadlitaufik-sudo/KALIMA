import { describe, expect, it } from 'vitest';
import { fromFirestoreFields } from './firestore-values.mjs';

describe('fromFirestoreFields', () => {
  it('converts nested maps and arrays into plain values', () => {
    const result = fromFirestoreFields({
      orders: {
        arrayValue: {
          values: [
            {
              mapValue: {
                fields: {
                  id: { stringValue: 'o-1' },
                  qty: { integerValue: '2103' },
                  harga: { doubleValue: 12.5 },
                  lunas: { booleanValue: true },
                  catatan: { nullValue: null },
                  dibuat: { timestampValue: '2026-11-17T00:00:00Z' },
                  items: { arrayValue: {} },
                  meta: { mapValue: {} },
                },
              },
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      orders: [
        {
          id: 'o-1',
          qty: 2103,
          harga: 12.5,
          lunas: true,
          catatan: null,
          dibuat: '2026-11-17T00:00:00Z',
          items: [],
          meta: {},
        },
      ],
    });
  });

  it('turns an empty array value into an empty list', () => {
    expect(fromFirestoreFields({ list: { arrayValue: {} } })).toEqual({ list: [] });
  });
});
