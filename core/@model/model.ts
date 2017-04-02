import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from '../helpers/defaultMethodHelpers';
import {SakuraApi} from '../sakura-api';

import {
  dbSymbols,
  IDbOptions
} from './db';
import {SapiMissingIdErr} from './errors';
import {jsonSymbols} from './json';
import {privateSymbols} from './private';

import {
  Collection,
  CollectionInsertOneOptions,
  CollectionOptions,
  Cursor,
  Db,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';

import debug = require('debug');

/**
 * Interface used by classes that are decorated with `@Model` ([[Model]]) to prevent
 * TypeScript type errors since TypeScript isn't aware that these methods were injected
 * by `@Model()`.
 */
export interface IModel {
  /* tslint:disable:variable-name */
  create?: () => Promise<InsertOneWriteOpResult>;
  delete?: (any) => Promise<DeleteWriteOpResultObject>;
  save?: (any) => Promise<UpdateWriteOpResult>;
  toJson?: (any) => any;
  toJsonString?: (any) => string;
  /* tslint:enable */
}

/**
 * Interface defining the valid properties for the `@Model({})` decorator ([[Model]]).
 */
export interface IModelOptions {
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

    /**
     * If true, fields without an Explicit @Db will still be written to the Db and used to rehydrate objects `fromDb`.
     */
    promiscuous?: boolean;
  };
  /**
   * Prevents the injection of CRUD functions (see [[Model]] function).
   */
  suppressInjection?: string[];
}

/**
 * A collection of symbols used internally by [[Model]].
 */
export const modelSymbols = {
  dbCollection: Symbol('dbCollection'),
  dbName: Symbol('dbName'),
  fromDb: Symbol('fromDb'),
  fromDbArray: Symbol('fromDbArray'),
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  modelOptions: Symbol('modelOptions'),
  target: Symbol('target'),
  toDb: Symbol('toDb'),
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
 *   * **`fromJson<T>(json: any, ...constructorArgs: any[]): T`** - takes a json object and returns an instantiated
 *   object of the proper type. It also takes a variadic array of parameters that are passed on to the object's
 *   constructor.
 *   * *static*: **`fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[]`** - takes an array of json objects and
 *   returns an array of instantiated objects of the property type. It also takes a variadic array of parameters that
 *   are passed onto the object's constructor.
 * * *instance*:
 *   * **`toJson()`** - returns the current object as json, respecting the various decorators like [[Private]]
 * and [[Json]].
 *   * **`toJsonString`** - works just like the aforementioned `toJson` but returns a string instead of a json object.
 *
 * These utility functions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(modelOptions?: IModelOptions): any {

  //--------------------------------------------------------------------------------------------------------------------
  // Developer notes:
  //
  // `target` represents the constructor function that is being reflected upon by the `@Model` decorator. It is
  // decorated via a Proxy and becomes `newConstrutor` <- this is the decorated constructor function resulting
  // from the `@Model` decorator.
  //
  // If you need to attach an "instance" property, you use `target.prototype` like you would with any other
  // constructor function.
  //====================================================================================================================

  modelOptions = modelOptions || {} as IModelOptions;

  return (target: any) => {

    // decorate the constructor
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        const c = Reflect.construct(t, args, nt);

        // isSakuraApiModel
        Reflect.defineProperty(c, modelSymbols.isSakuraApiModel, {
          value: true,
          writable: false
        });

        // map _id to id
        c._id = null;
        Reflect.defineProperty(c, 'id', {
          enumerable: false,
          get: () => c._id,
          set: (v) => c._id = v
        });

        // configure Db
        if (modelOptions.dbConfig) {
          target[modelSymbols.dbName] = modelOptions.dbConfig.db || null;
          if (!target[modelSymbols.dbName]) {
            throw new Error(`If you define a dbConfig for a model, you must define a db. target: ${target}`);
          }

          target[modelSymbols.dbCollection] = modelOptions.dbConfig.collection || null;
          if (!target[modelSymbols.dbCollection]) {
            throw new Error(`If you define a dbConfig for a model, you must define a collection. target: ${target}`);
          }
        }

        return c;
      }
    });

    newConstructor.debug = {
      normal: debug('sapi:Model')
    };
    newConstructor.prototype.debug = newConstructor.debug;

    newConstructor[modelSymbols.modelOptions] = modelOptions;

    // add default static methods
    addDefaultStaticMethods(newConstructor, 'removeAll', removeAll, modelOptions);
    addDefaultStaticMethods(newConstructor, 'removeById', removeById, modelOptions);
    addDefaultStaticMethods(newConstructor, 'get', get, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getOne', getOne, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getById', getById, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getCursor', getCursor, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getCursorById', getCursorById, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getCollection', getCollection, modelOptions);
    addDefaultStaticMethods(newConstructor, 'getDb', getDb, modelOptions);

    // Various internal methods are exposed to the integrator,
    // but allow the integrator to replace this functionality without
    // breaking the internal functionality
    newConstructor.fromDb = fromDb;
    newConstructor[modelSymbols.fromDb] = fromDb;

    newConstructor.fromDbArray = fromDbArray;
    newConstructor[modelSymbols.fromDbArray] = fromDbArray;

    newConstructor.fromJson = fromJson;
    newConstructor[modelSymbols.fromJson] = fromJson;

    newConstructor.fromJsonArray = fromJsonArray;
    newConstructor[modelSymbols.fromJsonArray] = fromJsonArray;

    newConstructor.toDb = toDb;
    newConstructor[modelSymbols.toDb] = toDb;

    // make the constructor function available to instance members
    newConstructor.prototype[modelSymbols.target] = target;

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, 'create', create, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'save', save, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'remove', remove, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'getCollection', getCollection, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'getDb', getDb, modelOptions);

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    return newConstructor;

    /////

    function getCollection(): Collection {
      const db = target.getDb();

      if (!db) {
        return null;
      }

      const col = db.collection(target[modelSymbols.dbCollection]);

      this.debug.normal(`.getCollection called, dbName: '${target[modelSymbols.dbName]},` +
        ` collection: ${target[modelSymbols.dbCollection]}', found?: ${!!col}`);

      return col;
    }

    /**
     * Expects to be called with a this context: toDb.call(this, ...);
     */
    function toDb(changeSet: any): any {
      target.debug.normal(`.toDb called, target '${target}'`);

      changeSet = changeSet || this;

      const dbOptionByPropertyName: Map<string, IDbOptions>
        = Reflect.getMetadata(dbSymbols.sakuraApiDbByPropertyName, this);

      const dbObj = {
        _id: this._id
      };

      for (const propertyName of Object.getOwnPropertyNames(changeSet)) {
        const propertyOptions = (dbOptionByPropertyName) ? dbOptionByPropertyName.get(propertyName) : null;

        if (propertyOptions && propertyOptions.field) {
          dbObj[propertyOptions.field] = changeSet[propertyName];
        } else if (propertyOptions) {
          dbObj[propertyName] = changeSet[propertyName];
        } else if ((modelOptions.dbConfig || {} as any).promiscuous) {
          if (!changeSet.propertyIsEnumerable(propertyName)) {
            continue;
          }
          dbObj[propertyName] = changeSet[propertyName];
        }
      }

      return dbObj;
    }
  };

  // tslint:disable-next-line: variable-name
  function toJsonString(replacer?: (any) => any, space?: string | number) {
    return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
  }
}

function create(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
  const target = this[modelSymbols.target];

  return new Promise((resolve, reject) => {
    const col = target.getCollection();

    this
      .debug
      .normal(`.crudCreate called, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, this);

    if (!col) {
      throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
    }

    const dbObj = target.toDb.call(this);

    col
      .insertOne(dbObj, options)
      .then((result) => {
        this.id = result.insertedId;
        return resolve(result);
      })
      .catch(reject);
  });
}

function save(set?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {
  const target = this[modelSymbols.target];

  const col = target.getCollection();
  this.debug.normal(`.crudSave called, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, set);

  if (!col) {
    throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
  }

  if (!this.id) {
    return Promise.reject(new SapiMissingIdErr('Model missing id field, cannot save', this));
  }

  const changeSet = set || this;
  const dbObj = target.toDb.call(this, changeSet);

  return new Promise((resolve, reject) => {
    col
      .updateOne({_id: this.id}, {$set: dbObj}, options)
      .then((result) => {
        if (set) {
          for (const prop of Object.getOwnPropertyNames(set)) {
            this[prop] = set[prop];
          }
        }
        return resolve(result);
      })
      .catch(reject);
  });
}

function remove(filter: any | null, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const target = this[modelSymbols.target];

  if (!filter) {
    this.debug.normal(`.crudDelete called without filter, calling .deleteById, id: %O`, this.id);
    return target.removeById(this.id, options);
  }

  return target.removeAll(filter, options);
}

function removeById(id: ObjectID, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  this
    .debug
    .normal(`.crudDeleteById called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  if (!id) {
    return Promise.reject(new SapiMissingIdErr('Call to delete without Id, cannot proceed', this));
  }

  return col.deleteOne({_id: id}, options);
}

function removeAll(filter: any, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  this
    .debug
    .normal(`.crudDelete called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, this.id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  return col.deleteMany(filter, options);
}

function get(filter: any, project?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const cursor = this.getCursor(filter, project);
    this.debug.normal(`.crudGetStatic called, dbName '${this[modelSymbols.dbName]}'`);

    cursor
      .toArray()
      .then((results) => {
        const objs = [];
        for (const result of results) {
          const obj = this.fromDb(result);
          if (obj) {
            objs.push(obj);
          }
        }
        resolve(objs);
      })
      .catch(reject);
  });
}

function getOne(filter: any, project?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const cursor = this.getCursor(filter, project);
    this.debug.normal(`.crudGetOneStatic called, dbName '${this[modelSymbols.dbName]}'`);

    cursor
      .limit(1)
      .next()
      .then((result) => {
        const obj = this.fromDb(result);
        resolve(obj);
      })
      .catch(reject);
  });
}

function getById(id: string, project?: any): Promise<any> {
  const cursor = this.getCursorById(id, project);
  this.debug.normal(`.crudGetByIdStatic called, dbName '${this[modelSymbols.dbName]}'`);

  return new Promise((resolve, reject) => {
    cursor
      .next()
      .then((result) => {
        const obj = this.fromDb(result);
        resolve(obj);
      })
      .catch(reject);
  });
}

function getCursor(filter: any, project?: any): Cursor<any> {
  const col = this.getCollection();
  this.debug.normal(`.crudGetCursorStatic called, dbName '${this[modelSymbols.dbName]}', found?: ${!!col}`);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  return (project)
    ? col.find(filter).project(project)
    : col.find(filter);
}

function getCursorById(id, project?: any) {
  this.debug.normal(`.crudGetCursorByIdStatic called, dbName '${this[modelSymbols.dbName]}'`);
  return this.getCursor({_id: id}, project).limit(1);
}

function fromDb(json: any, ...constructorArgs: any[]): any {
  this.debug.normal(`.fromDb called, target '${this.name}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  const obj = new this(...constructorArgs);

  const dbOptionsByFieldName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.sakuraApiDbByFieldName, obj);

  for (const fieldName of Object.getOwnPropertyNames(json)) {
    const dbFieldOptions = (dbOptionsByFieldName) ? dbOptionsByFieldName.get(fieldName) : null;

    if (dbFieldOptions) {
      obj[dbFieldOptions[dbSymbols.optionsPropertyName]] = json[fieldName];
    } else {
      if ((this[modelSymbols.modelOptions].dbConfig || {} as any).promiscuous) {
        obj[fieldName] = json[fieldName];
      }
    }
  }

  return obj;
}

function fromDbArray(jsons: any[], ...constructorArgs): any[] {
  this.debug.normal(`.fromDbArray called, target '${this.name}'`);

  if (!jsons || !Array.isArray(jsons)) {
    return [];
  }

  const results = [];
  for (const json of jsons) {
    const obj = this.fromDb(json, constructorArgs);
    if (obj) {
      results.push(obj);
    }
  }

  return results;
}

function fromJson(json: any, ...constructorArgs: any[]): any {
  this.debug.normal(`.fromJson called, target '${this.name}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  const obj = new this(...constructorArgs);

  const propertyNamesByJsonFieldName: Map<string, string>
    = Reflect.getMetadata(jsonSymbols.sakuraApiDbFieldToPropertyNames, obj);

  for (const field of Object.getOwnPropertyNames(json)) {
    const prop = (propertyNamesByJsonFieldName) ? propertyNamesByJsonFieldName.get(field) : null;

    if (prop) {
      obj[prop] = json[field]; // an @Json alias field
    } else if (Reflect.has(obj, field)) {
      obj[field] = json[field]; // a none @Json alias field
    }
  }

  return obj;
}

function fromJsonArray(json: any, ...constructorArgs: any[]): any[] {
  this.debug.normal(`.fromJsonArray called, target '${this.name}'`);

  const result = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      result.push(this[modelSymbols.fromJson](item, ...constructorArgs));
    }
  }

  return result;
}

function getDb(): Db {
  const db = SakuraApi.instance.dbConnections.getDb(this[modelSymbols.dbName]);

  this.debug.normal(`.getDb called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!db}`);

  return db;
}

function toJson() {
  this.debug.normal(`.toJson called, target '${this.name}'`);

  let jsonFieldNamesByProperty: Map<string, string>
    = Reflect.getMetadata(jsonSymbols.sakuraApiDbPropertyToFieldNames, this);

  jsonFieldNamesByProperty = jsonFieldNamesByProperty || new Map<string, string>();

  const privateFields: Map<string, string>
    = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, this);

  const dbOptionByPropertyName: Map<string, IDbOptions>
    = Reflect.getMetadata(dbSymbols.sakuraApiDbByPropertyName, this);

  const obj = {};
  for (const prop of Object.getOwnPropertyNames(this)) {
    if (typeof this[prop] === 'function') {
      continue;
    }

    if (dbOptionByPropertyName) {
      if ((dbOptionByPropertyName.get(prop) || {}).private) {
        continue;
      }
    }

    const override = (privateFields) ? privateFields.get(prop) : null;

    // do the function test for private otherwise do the boolean test
    if (override && typeof this[override] === 'function' && !this[override]()) {
      continue;
    } else if (override && !this[override]) {
      continue;
    }

    obj[jsonFieldNamesByProperty.get(prop) || prop] = this[prop];
  }

  return obj;
}
