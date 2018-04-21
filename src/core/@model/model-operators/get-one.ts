import {
  IMongoDBCollation,
  modelSymbols
} from '../model';
import { debug } from './index';

/**
 * @static Like the [[get]] method, but retrieves only the first result.
 * @param filter A MongoDb query.
 * @param project The fields to project (all if nto supplied).
 * @param collation MongoDB Collation Document.
 * @returns {Promise<any>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null if the
 * record is not found in the Db.
 */
export async function getOne(filter: any, project?: any, collation?: IMongoDBCollation): Promise<any> {
  const cursor = this.getCursor(filter, project, collation);
  debug.normal(`.getOne called, dbName '${this[modelSymbols.dbName]}'`);

  const result = await cursor
    .limit(1)
    .next();

  const obj = this.fromDb(result);
  return obj;
}
