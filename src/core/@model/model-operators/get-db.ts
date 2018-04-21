import { Db } from 'mongodb';
import { SapiDbForModelNotFound } from '../errors';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Gets the Mongo `Db` object associated with the connection defined in [[IModelOptions.dbConfig]].
 * @static Also available as a static method
 * @returns {Db}
 */
export function getDb(): Db {
  // can be called as instance or static method, so get the appropriate context
  const constructor = this[modelSymbols.constructor] || this;

  if (!constructor.sapi) {
    const target = constructor.name || constructor.constructor.name;
    throw new Error(`getDb called on model ${target} without an instance of ` +
      `SakuraAPI. Make sure you pass ${target} into the Model injector when you're ` +
      `instantiating SakuraApi`);
  }

  const db = constructor[modelSymbols.sapi].dbConnections.getDb(constructor[modelSymbols.dbName]);

  debug.normal(`.getDb called, dbName: '${constructor[modelSymbols.dbName]}', found?: ${!!db}`);

  if (!db) {
    throw new SapiDbForModelNotFound(constructor.name, constructor[modelSymbols.dbName]);
  }

  return db;
}
