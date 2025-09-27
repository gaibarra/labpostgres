const { redactSecrets } = require('../utils/secrets');

describe('redactSecrets utility', ()=>{
  test('redacta campos secretos planos y anidados', ()=>{
    const input = {
      openaiApiKey: 'sk-1234567890ABCDEFGH',
      nested: { whatsappApiKey: 'WAPP-SECRET-XYZ', keep: 'ok' },
      arr: [{ emailApiKey: 'mail-AAAAABBBBB' }, { none: true }]
    };
    const out = redactSecrets(input);
    expect(out.openaiApiKey).toBe('[REDACTED]');
    expect(out.nested.whatsappApiKey).toBe('[REDACTED]');
    expect(out.nested.keep).toBe('ok');
    expect(out.arr[0].emailApiKey).toBe('[REDACTED]');
    expect(out.arr[1].none).toBe(true);
  });
});
