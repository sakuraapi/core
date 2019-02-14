import { createCipheriv, randomBytes } from 'crypto';
import { encode as urlBase64Encode } from 'urlsafe-base64';

const IV_LENGTH = 16;

export type CipherKeyFunc = () => string;

/**
 * Encrypts a value like `toJson`. Use this when you need to take a single value and send it back to the client
 * so that you don't have to use `.toJson`.
 * @param value the value to encrypt
 * @param {string | CipherKeyFunc} cipherKey they secret key
 * @returns {string} the encrypted value
 */
export function encrypt(value: any, cipherKey: string | CipherKeyFunc): string {
  if (value === undefined) {
    return value;
  }

  const key = (typeof cipherKey === 'function')
    ? cipherKey()
    : cipherKey || '';

  const iv = randomBytes(IV_LENGTH);

  let cipher;
  try {
    cipher = createCipheriv('aes-256-gcm', key, iv);

    const v = typeof value === 'object' ? JSON.stringify(value) : value.toString();

    const buff = Buffer.concat([
      cipher.update(v, 'utf8'),
      cipher.final()
    ]);
    const hmac = cipher.getAuthTag();

    return `${urlBase64Encode(buff)}.${urlBase64Encode(hmac)}.${urlBase64Encode(iv)}`;
  } catch (err) {
    throw new Error(`@Json error encrypting ${err}`);
  }
}
