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
 * Interface used by classes that are decorated with `@`[[Model]] to prevent
 * TypeScript type errors since TypeScript isn't aware that these methods were injected
 * by `@Model()`.
 */
export interface IModel {
  /* tslint:disable:variable-name */
  create?: () => Promise<InsertOneWriteOpResult>;
  delete?: (any) => Promise<DeleteWriteOpResultObject>;
  save?: (any) => Promise<UpdateWriteOpResult>;
  toJson?: () => object;
  toJsonString?: () => string;
  /* tslint:enable */
}

/**
 * Interface defining the properties for the `@`[[Model]]({})` decorator.
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
 * ### Injection of CRUD & Utility Functions
 * `@`[[Model]] injects functions that are used by SakuraApi, but can also be used by the
 * integrator. Injected functions include:
 * * *static*:
 *   * [[fromDb]]
 *   * [[fromDbArray]]
 *   * [[fromJson]]
 *   * [[fromJsonArray]]
 *   * [[get]]
 *   * [[getById]]
 *   * [[getCursor]]
 *   * [[getCursorById]]
 *   * [[getDb]]
 *   * [[getOne]]
 *   * [[removeAll]]
 *   * [[removeById]]
 * * *instance*:
 *   * [[create]]
 *   * [[remove]]
 *   * [[save]]
 *   * [[toJson]]
 *
 * * *instance*:
 *   * **`toJsonString`** - works just like the aforementioned `toJson` but returns a string instead of a json object.
 *
 * Injected unctions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(modelOptions?: IModelOptions): any {
  modelOptions = modelOptions || {} as IModelOptions;

  // -------------------------------------------------------------------------------------------------------------------
  // Developer notes:
  //
  // `target` represents the constructor function that is being reflected upon by the `@Model` decorator. It is
  // decorated via a Proxy and becomes `newConstrutor` <- this is the decorated constructor function resulting
  // from the `@Model` decorator.
  //
  // To add an instance member: newConstructor.prototype.newFunction = () => {}
  // to add a static member: newConstructor.newFunction = () => {}
  // ===================================================================================================================

  return (target: any) => {

    const newConstructor = new Proxy(target, {
      // ---------------------------------------------------------------------------------------------------------------
      // Developer notes:
      //
      // The constructor proxy implements logic that needs to take place upon constructions
      // ===============================================================================================================
      construct: (t, args, nt) => {
        const c = Reflect.construct(t, args, nt);

        // map _id to id
        newConstructor.prototype._id = null;
        Reflect.defineProperty(c, 'id', {
          enumerable: false,
          get: () => c._id,
          set: (v) => c._id = v
        });

        // Check to make sure that if the @Model object has dbConfig upon construction, that it actually
        // has those properties defined. Otherwise, throw an error to help the integrator know what s/he's doing
        // wrong.
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

    // TODO change these to symbols
    newConstructor.debug = {
      normal: debug('sapi:Model')
    };
    newConstructor.prototype.debug = newConstructor.debug;

    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(newConstructor.prototype, modelSymbols.isSakuraApiModel, {
      value: true,
      writable: false
    });

    // make a copy of the model options available to the decorated objected
    newConstructor[modelSymbols.modelOptions] = modelOptions;
    // make the constructor function available to instance members
    newConstructor.prototype[modelSymbols.target] = newConstructor;

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // Static method injection... TypeScript does not see these, so you have to define a class level definition; for
    //
    //  example:
    //    @Model()
    //    class Example {
    //        get: (filter: any, project?: any) => Promise<any>;
    //    }
    //
    // This is fairly lame since it requires that the integrator have the signature of the injected static methods
    // in order to get typescript to work properly... this needs further thought to come up with something less... lame.
    // =================================================================================================================

    // Inject static methods
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

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    // Instance method injection... TypeScript won't know these are part of the type of the object being constructed
    // since they're dynamically injected. This is best done with TypeScript declaration merging.
    //     See: https://www.typescriptlang.org/docs/handbook/declaration-merging.html
    //
    //  example:
    //
    //    interface Example extends IModel {}
    //
    //    @Model()
    //    class Example {}
    // =================================================================================================================

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, 'create', create, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'save', save, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'remove', remove, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'getCollection', getCollection, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'getDb', getDb, modelOptions);

    newConstructor.prototype.toDb = toDb;
    newConstructor.prototype[modelSymbols.toDb] = toDb;

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    return newConstructor;

  };
}

//////////
function create(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
  const target = this[modelSymbols.target];

  return new Promise((resolve, reject) => {
    const col = target.getCollection();

    this
      .debug
      .normal(`.crudCreate called, dbName: '${target[modelSymbols.dbName].name}', found?: ${!!col}, set: %O`, this);

    if (!col) {
      throw new Error(`Database '${target[modelSymbols.dbName].name}' not found`);
    }

    const dbObj = this.toDb();

    col
      .insertOne(dbObj, options)
      .then((result) => {
        this.id = result.insertedId;
        return resolve(result);
      })
      .catch(reject);
  });
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

/**
 * Constructs an `@`Model object from a json object.
 * @param json The json object to be marshaled into an `@`[[Model]] object.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`Model object being
 * constructed.
 * @returns {{}}
 */
function fromJson(json: any, ...constructorArgs: any[]): object {
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

/**
 * Constructors an array of `@`Model objects from an array of json objects.
 * @param json The array of json objects to to be marshaled into an array of `@`[[Model]] objects.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`Model object being
 * constructed.
 * @returns [{{}}]
 */
function fromJsonArray(json: any, ...constructorArgs: any[]): object[] {
  this.debug.normal(`.fromJsonArray called, target '${this.name}'`);

  const result = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      result.push(this[modelSymbols.fromJson](item, ...constructorArgs));
    }
  }

  return result;
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

function getCollection(): Collection {
  const target = this[modelSymbols.target] || this;

  const db = target.getDb();

  if (!db) {
    return null;
  }

  const col = db.collection(target[modelSymbols.dbCollection]);

  this.debug.normal(`.getCollection called, dbName: '${target[modelSymbols.dbName]},` +
    ` collection: ${target[modelSymbols.dbCollection]}', found?: ${!!col}`);

  return col;
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

function getDb(): Db {
  const db = SakuraApi.instance.dbConnections.getDb(this[modelSymbols.dbName]);

  this.debug.normal(`.getDb called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!db}`);

  return db;
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
  const dbObj = this.toDb(changeSet);

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

function toDb(changeSet?: any): any {
  const target = this[modelSymbols.target];

  let modelOptions = target[modelSymbols.modelOptions];
  this.debug.normal(`.toDb called, target '${this.name}'`);

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

/**
 * Returns the current object as json, respecting the various decorators like [[Private]]
 * @returns {{}}
 */
function toJson(): object {
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

// tslint:disable-next-line: variable-name
function toJsonString(replacer?: (any) => any, space?: string | number) {
  return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
}
