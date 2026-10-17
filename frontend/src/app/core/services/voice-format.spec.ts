import { describe, expect, it } from 'vitest';
import { parseVoice, serializeVoice, VoiceProfile } from './voice-format';
const value: VoiceProfile = {
  experience: 'Angular\nSpring',
  style: 'Claro',
  topics: 'UX',
  avoid: '"revolucionario"',
  additional: 'Conservar\n## Temas\ncomo texto',
};
describe('voice prompt format', () => {
  it('round trips multiline user instructions without changing them', () =>
    expect(parseVoice(serializeVoice(value))).toEqual(value));
  it('keeps legacy and unrecognized prompts intact as additional instructions', () => {
    const old = 'Mi prompt\n## Temas\nPreservar literal';
    expect(parseVoice(old).additional).toBe(old);
    expect(parseVoice('[AutoPost: perfil de voz v2]\nxx').additional).toBe(
      '[AutoPost: perfil de voz v2]\nxx',
    );
  });
});
