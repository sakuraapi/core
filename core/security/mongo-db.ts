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

  public static sanitizeObject(input: any, filter: (key: any) => boolean): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (input instanceof Object) {
      sanitize(input);
    }

    return input;

    /////
    function sanitize(obj: any) {
      for (const key in obj) { // tslint:disable-line:forin
        const field = obj[key];
        if (filter(key)) {
          delete obj[key];
        } else if (field instanceof Object) {
          sanitize(field);
        }
      }
    }
  }
}
