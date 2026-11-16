import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translations', () => {
  it('has the same keys in English and Arabic', () => {
    expect(keysOf(ar).sort()).toEqual(keysOf(en).sort());
  });

  it('has no empty strings', () => {
    const empty = [en, ar].flatMap((file) =>
      keysOf(file).filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], file);
        return typeof value !== 'string' || value.trim() === '';
      }),
    );

    expect(empty).toEqual([]);
  });
});
