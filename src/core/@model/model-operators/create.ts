//////////
// tslint:disable:max-line-length
import {
  CollectionInsertOneOptions,
  InsertOneWriteOpResult
} from 'mongodb';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Creates a document in the Model's collection using
 * [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne) and takes an optional
 * CollectionInsertOneOptions.
 * @param options See: [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne)
 * @returns {Promise<T>} See:
 * [insertOneWriteOpCallback](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertOneWriteOpCallback).
 */
// tslint:enable:max-line-length
export async function create(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
  const constructor = this.constructor;

  const col = constructor.getCollection();

  debug.normal(`.create called, dbName: '${(constructor[modelSymbols.dbName] || {} as any).name}', found?: ${!!col}` +
    `, set: %O`, this);

  if (!col) {
    throw new Error(`Database '${(constructor[modelSymbols.dbName] || {} as any).name}' not found`);
  }

  const dbObj = this.toDb();
  const result = await col.insertOne(dbObj, options);
  this.id = result.insertedId;
  return result;
}
