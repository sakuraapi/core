import {
  CommonOptions,
  DeleteWriteOpResultObject,
  ObjectID
} from 'mongodb';
import { SapiMissingIdErr } from '../errors';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @static Removes a specific document from the database by its id.
 * @param id
 * @param options CommonOptions
 * @returns {DeleteWriteOpResultObject}
 */
export function removeById(id: any, options?: CommonOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  if (!(id instanceof ObjectID)) {
    id = (ObjectID.isValid(id)) ? new ObjectID(id) : id;
  }

  debug.normal(`.removeById called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  if (!id) {
    return Promise.reject(new SapiMissingIdErr('Call to delete without Id, cannot proceed', this));
  }

  return col.deleteOne({_id: id}, options);
}
