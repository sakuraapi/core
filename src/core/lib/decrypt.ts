import { createDecipheriv } from 'crypto';
import { decode as urlBase64Decode } from 'urlsafe-base64';
import { CipherKeyFunc } from './encrypt';

export class DecryptError extends Error {
  static message = 'invalid_cipher_text';

  constructor(public value: any) {
    super(DecryptError.message);
  }
}

/**
 * Decrypts a value like `.fromJson` would. Use this when dealing with a single encrypted value like an Id
 * that originates from a `.toJson` object that is being passed back as a query string parameter.
 *
 * Throws [[DecryptError]] if the cipher text provided is invalid.
 *
 * @param {string} value the encrypted value
 * @param {string | CipherKeyFunc} cipherKey they secret key
 * @returns {any} the unencrypted value
 */
export function decrypt(value: string, cipherKey: string | CipherKeyFunc): any {
  if (value === undefined) {
    return value;
  }

  const key = (typeof cipherKey === 'function')
    ? cipherKey()
    : cipherKey || '';

  const parts = (value && value.split) ? value.split('.') : [];

  if (parts.length !== 3) {
    throw new DecryptError(value);
  }

  const v = urlBase64Decode(parts[0]);
  const hmac = urlBase64Decode(parts[1]);
  const iv = urlBase64Decode(parts[2]);

  let buff: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(hmac);

    buff = Buffer.concat([
      decipher.update(v),
      decipher.final()
    ]);

    return JSON.parse(buff.toString('utf8'));
  } catch (err) {
    if (!err.message.startsWith('Unexpected token')) {
      throw err;
    }

    return buff.toString('utf8');
  }
}
