import { Collection } from 'mongodb';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Gets the MongoDB `Collection` object associated with this [[Model]] based on the [[IModelOptions.dbConfig]]
 * @static Also available as a static method
 * parameters passed into the [[Model]]'s definition.
 * @returns {Collection}
 */
export function getCollection(): Collection {
  // can be called as instance or static method, so get the appropriate context
  const constructor = this[modelSymbols.constructor] || this;

  const db = constructor.getDb();

  if (!db) {
    return null;
  }

  const col = db.collection(constructor[modelSymbols.dbCollection]);

  debug.normal(`.getCollection called, dbName: '${constructor[modelSymbols.dbName]},` +
    ` collection: ${constructor[modelSymbols.dbCollection]}', found?: ${!!col}`);

  return col;
}
