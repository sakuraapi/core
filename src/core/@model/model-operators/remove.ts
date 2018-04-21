import {
  CommonOptions,
  DeleteWriteOpResultObject
} from 'mongodb';
import { debug } from './index';

/**
 * @instance Removes the current Model's document from the database.
 * @param options MongoDB CommonOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
export function remove(options?: CommonOptions): Promise<DeleteWriteOpResultObject> {
  const constructor = this.constructor;
  debug.normal(`.remove called for ${(this || {} as any).id}`);
  return constructor.removeById(this.id, options);
}
