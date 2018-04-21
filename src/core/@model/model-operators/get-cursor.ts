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
 * @static Gets a `Cursor` from MongoDb based on the filter. This is a raw cursor from MongoDb. SakuraApi will not map
 * the results back to a [[Model]]. See [[get]] or [[getById]] to retrieve documents from MongoDb as their corresponding
 * [[Model]] objects.
 * @param filter A MongoDb query.
 * @param project The fields to project (all if not supplied).
 * @param collation MongoDB Collation Document.
 * @returns {Cursor<any>}
 */
export function getCursor(filter: any, project?: any, collation?: IMongoDBCollation): Cursor<any> {
  filter = filter || {};

  collation = collation || this[modelSymbols.dbCollation] || null;

  let col = this.getCollection();
  debug.normal(`.getCursor called, dbName '${this[modelSymbols.dbName]}', found?: ${!!col}`);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  // make sure the _id field is an ObjectId
  if (filter._id && !(filter._id instanceof ObjectID) && ObjectID.isValid(filter._id)) {
    filter._id = new ObjectID(filter._id.toString());
  }

  col = (project)
    ? col.find(filter).project(project)
    : col.find(filter);

  if (collation) {
    col.collation(collation);
  }

  return col;
}
