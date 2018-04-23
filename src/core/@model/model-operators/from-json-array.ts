import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @static Constructs an array of `@`Model objects from an array of json objects.
 * @param json The array of json objects to to be marshaled into an array of `@`[[Model]] objects.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`Model object being
 * constructed.
 * @returns [{{}}] Returns an array of instantiated objects based on the [[Model]]'s. Returns null if the `json`
 * parameter is null, undefined, or not an array.
 */
export function fromJsonArray(json: object[]): object[] {
  debug.normal(`.fromJsonArray called, target '${(this || {} as any).name}'`);

  const result = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      result.push(this[modelSymbols.fromJson](item));
    }
  }

  return result;
}
