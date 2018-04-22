//////////
// tslint:disable:max-line-length
import {
  CollectionInsertOneOptions,
  InsertOneWriteOpResult
} from 'mongodb';
import {
  beforeCreateSymbols,
  OnBeforeCreate
} from '../before-create';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Creates a document in the Model's collection using
 * [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne) and takes an optional
 * CollectionInsertOneOptions.
 * @param options See: [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne)
 * @param context The optional context to use for things like @BeforeSave or @BeforeCreate
 * @returns {Promise<T>} See:
 * [insertOneWriteOpCallback](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertOneWriteOpCallback).
 */
// tslint:enable:max-line-length
export async function create(options?: CollectionInsertOneOptions, context = 'default'): Promise<InsertOneWriteOpResult> {
  const constructor = this.constructor;

  const col = constructor.getCollection();

  debug.normal(`.create called, dbName: '${(constructor[modelSymbols.dbName] || {} as any).name}', found?: ${!!col}` +
    `, set: %O`, this);

  if (!col) {
    throw new Error(`Database '${(constructor[modelSymbols.dbName] || {} as any).name}' not found`);
  }

  // @BeforeCreate()
  const beforCreateMap: Map<string, OnBeforeCreate[]> = Reflect.getMetadata(beforeCreateSymbols.functionMap, this);
  const beforeCreateContextMap = (beforCreateMap) ? beforCreateMap.get(context) || [] : [];
  const beforeCreateStarMap = (beforCreateMap) ? beforCreateMap.get('*') || [] : [];
  for (const f of beforeCreateContextMap) {
    await f(this, context);
  }
  for (const f of beforeCreateStarMap) {
    await f(this, '*');
  }

  const dbObj = this.toDb();
  const result = await col.insertOne(dbObj, options);
  this.id = result.insertedId;
  return result;
}
