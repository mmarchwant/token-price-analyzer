import { describe, expect, it } from 'vitest';
import favicon from '../../public/favicon.svg?raw';
import indexHtml from '../../index.html?raw';

describe('site metadata', () => {
  it('uses the descriptive browser-tab title and the token favicon', () => {
    expect(indexHtml).toContain(
      '<title>Token Price Analyzer — AI model prices &amp; plans</title>',
    );
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="./favicon.svg" />');
    expect(favicon).toContain('<svg');
    expect(favicon).toContain('viewBox="0 0 64 64"');
  });
});
