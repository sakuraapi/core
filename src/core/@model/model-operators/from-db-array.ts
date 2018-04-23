import { IFromDbOptions } from '../model';
import { debug } from './index';

/**
 * @static Constructs an array of Models from an array of documents retrieved from the Db with all of their fields
 * properly mapped based on the [[Model]]'s various decorators (see [[Db]]).
 * @param jsons The array of documents returned from the Db.
 * @param constructorArgs A variadic set of parameters that are passed to the constructor of the [[Model]]'s class.
 * All of the resulting constructed objects will share the same constructor parameters.
 * @returns {object[]} Returns an array of instantiated objects which are instances of the [[Model]]'s class. Returns
 * null if the `jsons` parameter is null, undefined, or not an Array.
 *
 * @param {object[]} jsons
 * @param {IFromDbOptions} options
 * @returns {object[]}
 */
export function fromDbArray(jsons: object[], options?: IFromDbOptions): object[] {
  debug.normal(`.fromDbArray called, target '${(this || {} as any).name}'`);

  if (!jsons || !Array.isArray(jsons)) {
    return [];
  }

  const results: object[] = [];
  for (const json of jsons) {
    const obj = this.fromDb(json, options);
    if (obj) {
      results.push(obj);
    }
  }

  return results;
}
