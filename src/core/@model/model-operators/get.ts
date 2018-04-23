import {
  IDbGetParams,
  modelSymbols
} from '../model';
import { debug } from './index';

/**
 * @static Gets documents from the database and builds their corresponding [[Model]]s the resolves an array of those
 * objects.
 *
 * @param {IDbGetParams} params
 * @returns {Promise<object[]>} Returns a Promise that resolves with an array of instantiated [[Model]] objects based on the
 * documents returned from the database using MongoDB's find method. Returns an empty array if no matches are found
 * in the database.
 */
export async function get(params?: IDbGetParams): Promise<object[]> {
  debug.normal(`.get called, dbName '${this[modelSymbols.dbName]}'`);

  params = params || {};

  const cursor = this.getCursor(params.filter, params.project, params.collation);

  if (params.sort) {
    cursor.sort(params.sort);
  }

  if (params.skip) {
    cursor.skip(params.skip);
  }

  if (params.limit) {
    cursor.limit(params.limit);
  }

  if (params.comment) {
    cursor.limit(params.comment);
  }

  const results = await cursor.toArray();

  const options = (params.project) ? {strict: true} : null;

  const objs = [];
  for (const result of results) {
    const obj = this.fromDb(result, options);
    if (obj) {
      objs.push(obj);
    }
  }
  return objs;
}
