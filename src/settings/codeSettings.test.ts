import { describe, expect, it } from 'vitest';
import { DEFAULT_CODE_SETTINGS, parseCodeSettings } from './codeSettings.ts';

describe('parseCodeSettings', () => {
  it('starts from the defaults', () => {
    expect(parseCodeSettings(null)).toEqual(DEFAULT_CODE_SETTINGS);
    expect(parseCodeSettings('not json')).toEqual(DEFAULT_CODE_SETTINGS);
  });

  it('keeps valid fields and replaces malformed ones', () => {
    const parsed = parseCodeSettings(JSON.stringify({ wrap: false, fontSize: 'large', tabSize: 8, keys: 'emacs', lineNumbers: 'yes' }));
    expect(parsed).toEqual({ ...DEFAULT_CODE_SETTINGS, wrap: false, fontSize: 'large' });
    expect(parseCodeSettings(JSON.stringify({ fontSize: 'toString' })).fontSize).toBe('medium');
  });
});
