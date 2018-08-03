import { decrypt } from './decrypt';
import { encrypt } from './encrypt';

describe('decrypt', () => {
  it('error handling', () => {
    try {
      const v = encrypt('123', '$C&F)J@NcRfUjXn2r4u7x!A%D*G-KaPd');

      decrypt(v, '');
      fail('should have thrown');
    } catch (err) {
      expect(err.message).toBe('Invalid key length');
    }
  });
});
