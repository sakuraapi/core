import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from '../helpers/defaultMethodHelpers';
import {SakuraApi} from '../sakura-api';

import {
  dbSymbols,
  IDbOptions
} from './db';
import {
  SapiDbForModelNotFound,
  SapiMissingIdErr
} from './errors';
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
 *   * [[toJsonString]]
 *
 * Injected unctions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(modelOptions?: IModelOptions): (object) => any {
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
          if (!target[modelSymbols.dbName]) {
            throw new Error(`If you define a dbConfig for a model, you must define a db. target: ${target}`);
          }

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

    newConstructor[modelSymbols.dbName] = (modelOptions.dbConfig || {} as any).db || null;
    newConstructor[modelSymbols.dbCollection] = (modelOptions.dbConfig || {} as any).collection || null;

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
    addDefaultInstanceMethods(newConstructor, 'getCollection', getCollection, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'getDb', getDb, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'remove', remove, modelOptions);
    addDefaultInstanceMethods(newConstructor, 'save', save, modelOptions);

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
// tslint:disable:max-line-length
/**
 * @instance Creates a document in the Model's collection using
 * [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne) and takes an optional
 * CollectionInsertOneOptions.
 * @param options See: [insertOne](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne)
 * @returns {Promise<T>} See:
 * [insertOneWriteOpCallback](http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertOneWriteOpCallback).
 */
// tslint:enable:max-line-length
function create(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
  const target = this[modelSymbols.target];

  return new Promise((resolve, reject) => {
    const col = target.getCollection();

    this
      .debug
      .normal(`.create called, dbName: '${target[modelSymbols.dbName].name}', found?: ${!!col}, set: %O`, this);

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

/**
 * @static Creates an object from a MongoDb document with all of its fields properly mapped based on the [[Model]]'s
 * various decorators (see [[Db]]).
 * @param json The document returned from the Db.
 * @param constructorArgs A variadic set of parameters that are passed to the constructor of the [[Model]]'s class.
 * @returns {object} Returns an instantiated object which is an instance of the [[Model]]'s class. Returns null
 * if the `json` parameter is null, undefined or not an object.
 */
function fromDb(json: object, ...constructorArgs: any[]): object {
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

  // make sure the _id field is included as one of the properties
  if (!obj._id && (json as any)._id) {
    obj._id = (json as any)._id;
  }

  return obj;
}

/**
 * @static Constructs an array of Models from an array of documents retrieved from the Db with all of their fields
 * properly mapped based on the [[Model]]'s various decorators (see [[Db]]).
 * @param jsons The array of documents returned from the Db.
 * @param constructorArgs A variadic set of parameters that are passed to the constructor of the [[Model]]'s class.
 * All of the resulting constructed objects will share the same constructor parameters.
 * @returns {object[]} Returns an array of instantiated objects which are instances of the [[Model]]'s class. Returns
 * null if the `jsons` parameter is null, undefined, or not an Array.
 */
function fromDbArray(jsons: object[], ...constructorArgs): object[] {
  this.debug.normal(`.fromDbArray called, target '${this.name}'`);

  if (!jsons || !Array.isArray(jsons)) {
    return [];
  }

  const results: object[] = [];
  for (const json of jsons) {
    const obj = this.fromDb(json, constructorArgs);
    if (obj) {
      results.push(obj);
    }
  }

  return results;
}

/**
 * @static Constructs an `@`Model object from a json object (see [[Json]]).
 * @param json The json object to be marshaled into an `@`[[Model]] object.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`[[Model]] object being
 * constructed.
 * @returns {{}} Returns an instantiated [[Model]] from the provided json. Returns null if the `json` parameter is null,
 * undefined, or not an object.
 */
function fromJson(json: object, ...constructorArgs: any[]): object {
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
 * @static Constructs an array of `@`Model objects from an array of json objects.
 * @param json The array of json objects to to be marshaled into an array of `@`[[Model]] objects.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`Model object being
 * constructed.
 * @returns [{{}}] Returns an array of instantiated objects based on the [[Model]]'s. Returns null if the `json`
 * parameter is null, undefined, or not an array.
 */
function fromJsonArray(json: object[], ...constructorArgs: any[]): object[] {
  this.debug.normal(`.fromJsonArray called, target '${this.name}'`);

  const result = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      result.push(this[modelSymbols.fromJson](item, ...constructorArgs));
    }
  }

  return result;
}

/**
 * @static Gets documents from the database and builds their corresponding [[Model]]s the resolves an array of those
 * objects.
 * @param filter A MongoDb query
 * @param project The fields to project (all if not supplied)
 * @returns {Promise<T>} Returns a Promise that resolves with an array of instantiated [[Model]] objects based on the
 * documents returned from the database using MongoDB's find method. Returns an empty array if no matches are found
 * in the database.
 */
function get(filter: any, project?: any): Promise<object[]> {
  this.debug.normal(`.get called, dbName '${this[modelSymbols.dbName]}'`);
  return new Promise((resolve, reject) => {
    const cursor = this.getCursor(filter, project);

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

/**
 * @static Gets a document by its id from the database and builds its corresponding [[Model]] then resolves that object.
 * @param id The id of the document in the database.
 * @param project The fields to project (all if not supplied).
 * @returns {Promise<T>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null
 * if the record is not found in the Db.
 */
function getById(id: string, project?: any): Promise<any> {
  this.debug.normal(`.getById called, dbName '${this[modelSymbols.dbName]}'`);
  const cursor = this.getCursorById(id, project);

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

/**
 * @instance Gets the MongoDB `Collection` object associated with this [[Model]] based on the [[IModelOptions.dbConfig]]
 * @static Also available as a static method
 * parameters passed into the [[Model]]'s definition.
 * @returns {Collection}
 */
function getCollection(): Collection {
  // can be called as instance or static method, so get the appropriate context
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

/**
 * @static Gets a `Cursor` from MongoDb based on the filter. This is a raw cursor from MongoDb. SakuraApi will not map
 * the results back to a [[Model]]. See [[get]] or [[getById]] to retrieve documents from MongoDb as their corresponding
 * [[Model]] objects.
 * @param filter A MongoDb query.
 * @param project The fields to project (all if not supplied).
 * @returns {Cursor<any>}
 */
function getCursor(filter: any, project?: any): Cursor<any> {
  const col = this.getCollection();
  this.debug.normal(`.getCursor called, dbName '${this[modelSymbols.dbName]}', found?: ${!!col}`);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  // make sure the _id field is an ObjectId
  if (filter._id && !(filter._id instanceof ObjectID) && ObjectID.isValid(filter._id)) {
    filter._id = new ObjectID(filter._id);
  }

  return (project)
    ? col.find(filter).project(project)
    : col.find(filter);
}

/**
 * @static Gets a `Cursor` from MonogDb based on the supplied `id` and applies a `limit(1)` before returning the cursor.
 * @param id the document's id in the database.
 * @param project The fields to project (all if not supplied).
 * @returns {Cursor<T>}
 */
function getCursorById(id, project?: any): Cursor<any> {
  this.debug.normal(`.getCursorById called, dbName '${this[modelSymbols.dbName]}'`);
  return this.getCursor({_id: id}, project).limit(1);
}

/**
 * @instance Gets the Mongo `Db` object associated with the connection defined in [[IModelOptions.dbConfig]].
 * @static Also available as a static method
 * @returns {Db}
 */
function getDb(): Db {
  // can be called as instance or static method, so get the appropriate context
  const target = this[modelSymbols.target] || this;
  const db = SakuraApi.instance.dbConnections.getDb(target[modelSymbols.dbName]);

  this.debug.normal(`.getDb called, dbName: '${target[modelSymbols.dbName]}', found?: ${!!db}`);

  if (!db) {
    throw new SapiDbForModelNotFound(target.name, target[modelSymbols.dbName]);
  }

  return db;
}

/**
 * @static Like the [[get]] method, but retrieves only the first result.
 * @param filter A MongoDb query.
 * @param project The fields to project (all if nto supplied).
 * @returns {Promise<any>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null if the
 * record is not found in the Db.
 */
function getOne(filter: any, project?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const cursor = this.getCursor(filter, project);
    this.debug.normal(`.getOne called, dbName '${this[modelSymbols.dbName]}'`);

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

/**
 * @instance Removes the current Model's document from the database.
 * @param options MongoDB CollectionOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
function remove(options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const target = this[modelSymbols.target];

  this.debug.normal(`.remove called for ${this.id}`);
  return target.removeById(this.id, options);
}

/**
 * @static Removes all documents from the database that match the filter criteria.
 * @param filter A MongoDB query.
 * @param options MongoDB CollectionOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
function removeAll(filter: any, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  this
    .debug
    .normal(`.removeAll called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, this.id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  return col.deleteMany(filter, options);
}

/**
 * @static Removes a specific document from the database by its id.
 * @param id
 * @param options CollectionOptions
 * @returns {DeleteWriteOpResultObject}
 */
function removeById(id: ObjectID, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  this
    .debug
    .normal(`.removeById called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, id);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  if (!id) {
    return Promise.reject(new SapiMissingIdErr('Call to delete without Id, cannot proceed', this));
  }

  return col.deleteOne({_id: id}, options);
}

/**
 * @instance Performs a MongoDB updateOne if the current [[Model]] has an Id.
 * @param changeSet The change set. For example:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * This change set would cause only the `firstName` field to be updated. If the `set` parameter is not provided,
 * `save` will assume the entire [[Model]] is the change set (obeying the various decorators like [[Db]]).
 * @param options The MongoDB ReplaceOneOptions. If you want to set this, but not the `set`, then pass null into `set`.
 * @returns {any}
 */
function save(changeSet?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {
  const target = this[modelSymbols.target];

  const col = target.getCollection();
  this.debug.normal(`.save called, dbName: '${target[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, changeSet);

  if (!col) {
    throw new Error(`Database '${target[modelSymbols.dbName]}' not found`);
  }

  if (!this.id) {
    return Promise.reject(new SapiMissingIdErr('Model missing id field, cannot save', this));
  }

  const set = changeSet || this;
  const dbObj = this.toDb(set);

  return new Promise((resolve, reject) => {
    col
      .updateOne({_id: this.id}, {$set: dbObj}, options)
      .then((result) => {
        if (changeSet) {
          for (const prop of Object.getOwnPropertyNames(changeSet)) {
            this[prop] = changeSet[prop];
          }
        }
        return resolve(result);
      })
      .catch(reject);
  });
}

/**
 * @instance Builds and returns a change set object that properly obeys the various decorators (like [[Db]]). The
 * resulting object is what's persisted to the database.
 * @param changeSet The change set. For example:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * This change set would cause only the `firstName` field to be updated. If the `set` parameter is not provided,
 * `toDb` will assume the entire [[Model]] is the change set (obeying the various decorators like [[Db]]).
 * @returns {{_id: (any|ObjectID|number)}}
 */
function toDb(changeSet?: object): object {
  const target = this[modelSymbols.target];

  const modelOptions = target[modelSymbols.modelOptions];
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
 * @instance Returns the current object as json, respecting the various decorators like [[Db]]
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

    if (prop === '_id') {
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

/**
 * @instance Returns the current [[Model]] as a json string, respecting the various decorators like [[Db]]
 * @param replacer See JavaScript's standard `JSON.stringify`.
 * @param space See JavaScript's standard `JSON.stringify`.
 * @returns {string}
 */
function toJsonString(replacer?: () => any | Array<string | number>, space?: string | number): string {
  this.debug.normal(`.toJsonString called, target '${this.name}'`);
  return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
}
