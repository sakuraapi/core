import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Returns the current [[Model]] as a json string, respecting the various decorators like [[Db]]
 * @param replacer See JavaScript's standard `JSON.stringify`.
 * @param space See JavaScript's standard `JSON.stringify`.
 * @returns {string}
 */
export function toJsonString(replacer?: () => any | Array<string | number>, space?: string | number): string {
  debug.normal(`.toJsonString called, target '${((this || {} as any).constructor || {} as any).name}'`);
  return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
}
