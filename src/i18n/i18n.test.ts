import { describe, expect, it } from 'vitest';
import { resources } from './index';

type JsonObject = { [key: string]: string | JsonObject };

function getKeysAndNonEmptyValues(
  obj: JsonObject,
  prefix = '',
): { keys: string[]; emptyKeys: string[] } {
  let keys: string[] = [];
  let emptyKeys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      const nested = getKeysAndNonEmptyValues(value as JsonObject, fullPath);
      keys = keys.concat(nested.keys);
      emptyKeys = emptyKeys.concat(nested.emptyKeys);
    } else if (typeof value === 'string') {
      keys.push(fullPath);
      if (value.trim() === '') {
        emptyKeys.push(fullPath);
      }
    } else {
      emptyKeys.push(fullPath);
    }
  }

  return { keys, emptyKeys };
}

describe('i18n key parity and completeness', () => {
  const namespaces = Object.keys(resources.en) as (keyof typeof resources.en)[];

  it('has all required namespaces in both en and pl', () => {
    expect(Object.keys(resources.en).sort()).toEqual(Object.keys(resources.pl).sort());
  });

  namespaces.forEach((ns) => {
    describe(`namespace: ${ns}`, () => {
      it('en and pl have identical deep key sets and no empty values', () => {
        const enRes = resources.en[ns] as JsonObject;
        const plRes = resources.pl[ns] as JsonObject;

        expect(enRes).toBeDefined();
        expect(plRes).toBeDefined();

        const enData = getKeysAndNonEmptyValues(enRes);
        const plData = getKeysAndNonEmptyValues(plRes);

        expect(enData.keys.sort()).toEqual(plData.keys.sort());
        expect(enData.emptyKeys).toEqual([]);
        expect(plData.emptyKeys).toEqual([]);
      });
    });
  });
});
