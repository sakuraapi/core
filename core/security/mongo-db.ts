/**
 * SanitizeMongoDB is a set of utility functions to help sanitize user input to make it safe to
 * pass to MongoDB. Remember, security is always the integrators' ultimate responsibility - SakuraApi is here to
 * help you with security, not replace you.
 */
export class SanitizeMongoDB {

  /**
   * Deep inspects the input for any keys that start with $ and deletes them. If the input is not
   * an object, the original input will be returned.
   */
  public static removeAll$Keys(input: any): any {
    return SanitizeMongoDB.sanitizeObject(input, (key) => {
      return /^\$/.test(key);
    });
  }

  /**
   * Deep inspects the input for any $where keys and deletes them. If the input is not
   * an object, the original input will be returned.
   */
  public static remove$where(input: any): any {
    return SanitizeMongoDB.sanitizeObject(input, (key) => {
      return key === '$where';
    });
  }

  /**
   * Takes a json string, or an object, and sanitizes it with the provided filter function.
   * @param input string or object to be sanitized. Note: if input is a string, and it cannot be parsed with JSON.parse
   * a (SyntaxError)[https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SyntaxError]
   * will be thrown.
   * @param filter the function that filters what's permitted in the resulting object. Returns true if the key should be
   * removed.
   * @returns {any} if the input was a valid JSON string, the result will be a sanitized JSON object
   */
  public static sanitizeObject(input: any, filter: (key: any) => boolean): any {
    if (input === null || input === undefined) {
      return input;
    }

    const obj = (typeof input === 'string')
      ? JSON.parse(input)
      : input;

    sanitize(obj);

    return obj;

    /////
    function sanitize(targetObj: any) {
      for (const key in targetObj) { // tslint:disable-line:forin
        const field = targetObj[key];

        if (filter(key)) {
          delete targetObj[key];
        } else if (typeof field === 'object') {
          sanitize(field);
        }
      }
    }
  }

  public static whiteList$Keys(input: any, whiteList: string[]): any {
    whiteList = whiteList || [];
    return SanitizeMongoDB.sanitizeObject(input, (key) => {
      return /^\$/.test(key) && whiteList.indexOf(key) === -1;
    });
  }
}
