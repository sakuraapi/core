import {ObjectID} from 'mongodb';

/**
 * @Internal used internally by SakuraApi. Don't use it.
 */
export function shouldRecurse(source): boolean {
  return !!source
    && typeof source === 'object'
    && !(source instanceof ObjectID)
    && !(source instanceof Date)
    && !Array.isArray(source)
    && !((source.constructor || {}).name === 'ObjectID');
}
