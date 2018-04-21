import { ObjectID } from 'mongodb';
import {
  IMongoDBCollation,
  modelSymbols
} from '../model';
import { debug } from './index';

/**
 * @static Gets a document by its id from the database and builds its corresponding [[Model]] then resolves that object.
 * @param id The id of the document in the database.
 * @param project The fields to project (all if not supplied).
 * @param collation MongoDB Collation Document.
 * @returns {Promise<T>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null
 * if the record is not found in the Db.
 */
export async function getById(id: string | ObjectID, project?: any, collation?: IMongoDBCollation): Promise<any> {
  debug.normal(`.getById called, dbName '${this[modelSymbols.dbName]}'`);
  const cursor = this.getCursorById(id, project, collation);

  const options = (project) ? {strict: true} : null;
  const result = await cursor.next();

  return this.fromDb(result, options);
}
