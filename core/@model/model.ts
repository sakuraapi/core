import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from '../helpers/defaultMethodHelpers';
import {jsonSymbols} from './json';
import {privateSymbols} from './private';
import {SakuraApi} from '../sakura-api';
import {
  Db,
  Collection,
  CollectionOptions,
  CollectionInsertOneOptions,
  Cursor,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';
import {SapiMissingIdErr} from './errors';

const debug = require('debug')('sapi:Model');

/**
 * Interface used by classes that are decorated with `@Model` ([[Model]]) to prevent
 * TypeScript type errors since TypeScript isn't aware that these methods were injected
 * by `@Model()`.
 */
export interface IModel {
  create?: () => Promise<InsertOneWriteOpResult>;
  delete?: (any) => Promise<DeleteWriteOpResultObject>;
  save?: (any) => Promise<UpdateWriteOpResult>;
  toJson?: (any) => any;
  toJsonString?: (any) => string;
}

/**
 * Interface defining the valid properties for the `@Model({})` decorator ([[Model]]).
 */
export interface ModelOptions {
  /**
   * The database to which this @Model object is bound
   */
  dbConfig?: {
    /**
     * The name of the database for this model which is used to retrieve the `MongoDB` `Db` object from
     * [[SakuraMongoDbConnection]]. I.e, whatever name you used in your congifuration of [[SakuraMongoDbConnection]]
     * for the database connection for this model, use that name here.
     */
    db: string;

    /**
     * The name of the collection in the database referenced in `db` that represents this model.
     */
    collection: string;
  }
  /**
   * Prevents the injection of CRUD functions (see [[Model]] function).
   */
  suppressInjection?: string[];
}

/**
 * A collection of symbols used internally by [[Model]].
 */
export const modelSymbols = {
  dbName: Symbol('dbName'),
  dbCollection: Symbol('dbCollection'),
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  toJson: Symbol('toJson'),
  toJsonString: Symbol('toJsonString')
};

/**
 * Decorator applied to classes that represent models for SakuraApi.
 *
 * ### Example
 * <pre>
 * <span>@</span>Model()
 * class User {
 *    firstName: string = '';
 *    lastName: string = '';
 * }
 * </pre>
 *
 * ### Injection
 * #### Metadata
 * `@Model` injects metadata for the class being decorated that's used by
 * SakuraApi to support its functionality.
 *
 * #### CRUD Functions
 * `@Model` injects functions that are used by SakuraApi, but can also be used by the
 * integrator. Injected functions include:
 * * *static*:
 *   * get
 *   * getById
 *   * delete
 * * *instance*:
 *   * create
 *   * save
 *   * delete
 *
 * #### Utility Functions
 * * *static*:
 *   * **`fromJson<T>(json: any, ...constructorArgs: any[]): T`** - takes a json object and returns an instantiated object
 * of the proper type. It also takes a variadic array of parameters that are passed on to the object's constructor.
 *   * *static*: **`fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[]`** - takes an array of json objects and returns an
 * array of instantiated objects of the property type. It also takes a variadic array of parameters that are passed onto the
 * object's constructor.
 * * *instance*:
 *   * **`toJson()`** - returns the current object as json, respecting the various decorators like [[Private]]
 * and [[Json]].
 *   * **`toJsonString`** - works just like the aforementioned `toJson` but returns a string instead of a json object.
 *
 * These utility functions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(options?: ModelOptions): any {
  options = options || <ModelOptions>{};

  return function (target: any) {
    // add default static methods
    addDefaultStaticMethods(target, 'delete', crudDeleteStatic, options);
    addDefaultStaticMethods(target, 'deleteById', crudDeleteByIdStatic, options);
    addDefaultStaticMethods(target, 'get', crudGetStatic, options);
    addDefaultStaticMethods(target, 'getById', crudGetByIdStatic, options);
    addDefaultStaticMethods(target, 'getCollection', getCollection, options);
    addDefaultStaticMethods(target, 'getDb', getDb, options);

    // Various internal methods are exposed to the integrator,
    // but allow the integrator to replace this functionality without
    // breaking the internal functionality
    target.fromJson = fromJson;
    target[modelSymbols.fromJson] = fromJson;

    target.fromJsonArray = fromJsonArray;
    target[modelSymbols.fromJsonArray] = fromJsonArray;

    // decorate the constructor
    let newConstructor = new Proxy(target, {
      construct: function (t, args, nt) {
        let c = Reflect.construct(t, args, nt);

        // isSakuraApiModel
        Reflect.defineProperty(c, modelSymbols.isSakuraApiModel, {
          value: true,
          writable: false
        });

        // map _id to id
        c._id = null;
        Reflect.defineProperty(c, 'id', {
          get: () => c._id,
          set: (v) => c._id = v
        });

        // configure Db
        if (options.dbConfig) {
          target[modelSymbols.dbName] = options.dbConfig.db || null;
          if (!target[modelSymbols.dbName]) {
            throw new Error(`If you define a dbConfig for a model, you must define a db. target: ${target}`);
          }

          target[modelSymbols.dbCollection] = options.dbConfig.collection || null;
          if (!target[modelSymbols.dbCollection]) {
            throw new Error(`If you define a dbConfig for a model, you must define a collection. target: ${target}`);
          }
        }

        return c;
      }
    });

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, 'create', crudCreate, options);
    addDefaultInstanceMethods(newConstructor, 'save', crudSave, options);
    addDefaultInstanceMethods(newConstructor, 'delete', crudDelete, options);
    addDefaultInstanceMethods(newConstructor, 'getCollection', getCollection, options);
    addDefaultInstanceMethods(newConstructor, 'getDb', getDb, options);
    addDefaultInstanceMethods(newConstructor, 'getNewId', getNewId, options);

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    return newConstructor;

    /////
    function crudCreate(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
      return new Promise((resolve, reject) => {
        let col = target.getCollection();
        debug(`.crudCreate started, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, this);

        if (!col) {
          throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
        }

        col
          .insertOne(this, options)
          .then((result) => {
            this.id = result.insertedId;
            return resolve(result);
          })
          .catch(reject);
      });
    }

    function crudSave(set?: {[key: string]: any} | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {

      let col = target.getCollection();
      debug(`.crudSave started, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, set);

      if (!col) {
        throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
      }

      if (!this.id) {
        return Promise.reject(new SapiMissingIdErr('Model missing id field, cannot save', this));
      }

      return new Promise((resolve, reject) => {
        col
          .updateOne({_id: this.id}, {$set: set || this}, options)
          .then((result) => {
            if (set) {
              for (let prop of Object.getOwnPropertyNames(set)) {
                this[prop] = set[prop];
              }
            }
            return resolve(result);
          })
          .catch(reject);
      });
    }

    function crudDelete(filter: any | null, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
      if (!filter) {
        debug(`.crudDelete started without filter, calling .deleteById, id: %O`, this.id);
        return target.deleteById(this.id, options);
      }

      return target.delete(filter, options);
    }

    function crudDeleteByIdStatic(id: ObjectID, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
      let col = target.getCollection();
      debug(`.crudDeleteById started, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, id);

      if (!col) {
        throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
      }

      if (!id) {
        return Promise.reject(new SapiMissingIdErr('Call to delete without Id, cannot proceed', target));
      }

      return col.deleteOne({_id: id}, options);
    }

    function crudDeleteStatic(filter: any, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
      let col = target.getCollection();
      debug(`.crudDelete started, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, this.id);

      if (!col) {
        throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
      }

      return col.deleteMany(filter, options);
    }

    function crudGetStatic(filter: any, project?: any): Cursor<any> {
      let col = target.getCollection();
      debug(`.crudGetStatic started, dbName '${target[modelSymbols.dbName]}', found?: ${!!col}`);

      if (!col) {
        throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
      }

      return (project)
        ? col.find(filter).project(project)
        : col.find(filter);
    }

    function crudGetByIdStatic(id, project?: any) {
      return target.get({_id: id}, project).limit(1);
    }

    function fromJson<T>(json: any, ...constructorArgs: any[]): T {
      if (!json || typeof json !== 'object') {
        return null;
      }

      let obj = new newConstructor(...constructorArgs);

      let propertyNamesByJsonFieldName: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonFieldToPropertyNames, obj);

      for (let field of Object.getOwnPropertyNames(json)) {
        let prop = (propertyNamesByJsonFieldName) ? propertyNamesByJsonFieldName.get(field) : null;
        if (prop) {
          obj[prop] = json[field]; // an @Json alias field
        } else if (Reflect.has(obj, field)) {
          obj[field] = json[field]; // a none @Json alias field
        }
      }

      return obj;
    }

    function fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[] {
      let result = [];

      if (Array.isArray(json)) {
        for (let item of json) {
          result.push(target[modelSymbols.fromJson](item, ...constructorArgs));
        }
      }

      return result;
    }

    function getCollection(): Collection {
      let db = target.getDb();

      if (!db) {
        return null;
      }

      let col = db.collection(target[modelSymbols.dbCollection]);

      debug(`.getCollection started, dbName: '${target[modelSymbols.dbName]}, collection: ${target[modelSymbols.dbCollection]}', found?: ${!!col}`);

      return col;
    }

    function getDb(): Db {
      let db = SakuraApi.instance.dbConnections.getDb(target[modelSymbols.dbName]);

      debug(`.getDb started, dbName: '${target[modelSymbols.dbName]}', found?: ${!!db}`);

      return db;
    }

    function getNewId(): ObjectID {
      return new ObjectID();
    }

    function toJson() {
      let jsonFieldNamesByProperty: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonPropertyToFieldNames, this);
      jsonFieldNamesByProperty = jsonFieldNamesByProperty || new Map<string,string>();

      let privateFields: Map<string, string> = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, this);

      let obj = {};
      for (let prop of Object.getOwnPropertyNames(this)) {
        if (typeof this[prop] !== 'function') {

          let override = (privateFields) ? privateFields.get(prop) : null;
          if (override && typeof this[override] === 'function' && !this[override]()) {
            continue;
          } else if (override && !this[override]) {
            continue;
          }
          obj[jsonFieldNamesByProperty.get(prop) || prop] = this[prop];
        }
      }
      return obj;
    }

    function toJsonString(replacer?: (any) => any, space?: string | number) {
      return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
    }
  };
}
