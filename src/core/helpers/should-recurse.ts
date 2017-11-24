import {ObjectID} from 'mongodb';

export function shouldRecurse(source): boolean {
  return !!source
    && typeof source === 'object'
    && !(source instanceof ObjectID)
    && !(source instanceof Date)
    && !Array.isArray(source)
    && !((source.constructor || {}).name === 'ObjectID');
}
