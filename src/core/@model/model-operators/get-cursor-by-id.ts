import {
  Cursor,
  ObjectID
} from 'mongodb';
import {
  IMongoDBCollation,
  modelSymbols
} from '../model';
import { debug } from './index';

/**
 * @static Gets a `Cursor` from MonogDb based on the supplied `id` and applies a `limit(1)` before returning the cursor.
 * @param id the document's id in the database.
 * @param project The fields to project (all if not supplied).
 * @param collation MongoDB Collation Document.
 * @returns {Cursor<T>}
 */
export function getCursorById(id: ObjectID | string, project?: any, collation?: IMongoDBCollation): Cursor<any> {
  debug.normal(`.getCursorById called, dbName '${this[modelSymbols.dbName]}'`);

  return this
    .getCursor({
      _id: (id instanceof ObjectID) ? id : id.toString() || `${id}`
    }, project, collation)
    .limit(1);
}
