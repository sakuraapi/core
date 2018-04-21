import {
  CommonOptions,
  DeleteWriteOpResultObject
} from 'mongodb';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @static Removes all documents from the database that match the filter criteria.
 * @param filter A MongoDB query.
 * @param options MongoDB CommonOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
export function removeAll(filter: any, options?: CommonOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  debug.normal(`.removeAll called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`,
    (this || {} as any).id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  return col.deleteMany(filter, options);
}
