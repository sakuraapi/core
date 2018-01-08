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
}                                from 'mongodb';
import {getDependencyInjections} from '../@injectable/injectable';
import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods,
  shouldRecurse
}                                from '../helpers';
import {
  dbSymbols,
  IDbOptions
}                                from './db';
import {
  SapiDbForModelNotFound,
  SapiInvalidModelObject,
  SapiMissingIdErr
}                                from './errors';
import {
  IJsonOptions,
  jsonSymbols
}                                from './json';
import {privateSymbols}          from './private';

const debug = {
  normal: require('debug')('sapi:model')
};

/**
 * Interface defining the properties used for retrieving records from the DB
 */
export interface IDbGetParams {
  filter: any;
  limit?: number;
  project?: any;
  skip?: number;
}

/**
 * Interface defining the valid properties for options passed to [[toDb]].
 */
export interface IFromDbOptions {
  /**
   * If set to true, the resulting model will only have the properties for fields present in the document returned from
   * the database
   */
  strict?: boolean;
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
  constructor: Symbol('constructor'),
  dbCollection: Symbol('dbCollection'),
  dbName: Symbol('dbName'),
  fromDb: Symbol('fromDb'),
  fromDbArray: Symbol('fromDbArray'),
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  fromJsonToDb: Symbol('fromJsonToDb'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  modelOptions: Symbol('modelOptions'),
  sapi: Symbol('sapi'),
  toDb: Symbol('toDb'),
  toJson: Symbol('toJson'),
  toJsonString: Symbol('toJsonString')
};

/**
 * Decorator applied to classes that represent models for SakuraApi.
 *
 * ### Example
 * <pre>
 *
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
 *   * [[fromJsonToDb]]
 *   * [[get]]
 *   * [[getById]]
 *   * [[getCursor]]
 *   * [[getCursorById]]
 *   * [[getDb]]
 *   * [[getOne]]
 *   * [[removeAll]]
 *   * [[removeById]]
 *   * sapi: the `@`[[Routable]]'s instance of [[SakuraApi]] that was injected during SakuraApi construction
 *   * sapiConfig: the `@`[[Routable]]'s [[SakuraApi]] config (this is a shortcut to sapi.config)
 * * *instance*:
 *   * [[create]]
 *   * [[remove]]
 *   * [[save]]
 *   * [[toJson]]
 *   * [[toJsonString]]
 *
 * Injected functions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(modelOptions?: IModelOptions): (object) => any {
  modelOptions = modelOptions || {} as IModelOptions; // tslint:disable-line:no-object-literal-type-assertion

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
    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The constructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {

        const diArgs = getDependencyInjections(target, t, target[modelSymbols.sapi]);

        const c = Reflect.construct(t, diArgs, nt);

        // map _id to id
        newConstructor.prototype._id = null;
        Reflect.defineProperty(c, 'id', {
          configurable: true,
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

    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(newConstructor.prototype, modelSymbols.isSakuraApiModel, {
      value: true,
      writable: false
    });

    Reflect.defineProperty(newConstructor, modelSymbols.isSakuraApiModel, {
      value: true,
      writable: false
    });

    // make a copy of the model options available to the decorated objected
    newConstructor[modelSymbols.modelOptions] = modelOptions;
    // tag instances with the constructor function for the class to make it easier to determine when `this`
    // is pointing to an instance of the class or the class constructor.
    newConstructor.prototype[modelSymbols.constructor] = newConstructor;

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
    addDefaultStaticMethods(newConstructor, removeAll, modelOptions);
    addDefaultStaticMethods(newConstructor, removeById, modelOptions);
    addDefaultStaticMethods(newConstructor, get, modelOptions);
    addDefaultStaticMethods(newConstructor, getOne, modelOptions);
    addDefaultStaticMethods(newConstructor, getById, modelOptions);
    addDefaultStaticMethods(newConstructor, getCursor, modelOptions);
    addDefaultStaticMethods(newConstructor, getCursorById, modelOptions);
    addDefaultStaticMethods(newConstructor, getCollection, modelOptions);
    addDefaultStaticMethods(newConstructor, getDb, modelOptions);

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

    newConstructor.fromJsonToDb = fromJsonToDb;
    newConstructor[modelSymbols.fromJsonToDb] = fromJsonToDb;

    newConstructor[modelSymbols.sapi] = null; // injected by [[SakuraApi.registerModels]]

    // Injects sapi as a shortcut property on models pointing to newConstructor[modelSymbols.sapi]
    Reflect.defineProperty(newConstructor, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[modelSymbols.sapi]
    });

    // Injects sapi as a shortcut property on models pointing to newConstructor[modelSymbols.sapi]
    Reflect.defineProperty(newConstructor.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[modelSymbols.sapi]
    });

    // Injects sapiConfig as a shortcut property on models pointing to newConstructor[modelSymbols.sapi].config
    Reflect.defineProperty(newConstructor, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    // Injects sapiConfig as a shortcut property on models pointing to newConstructor[modelSymbols.sapi].config
    Reflect.defineProperty(newConstructor.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // Instance method injection... TypeScript won't know these are part of the type of the object being constructed
    // since they're dynamically injected. You can use the SapiModelMixin to overcome this.
    //
    //  example:
    //    @Model()
    //    class Example extends SapiModelMixin() {}
    // =================================================================================================================

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, create, modelOptions);
    addDefaultInstanceMethods(newConstructor, getCollection, modelOptions);
    addDefaultInstanceMethods(newConstructor, getDb, modelOptions);
    addDefaultInstanceMethods(newConstructor, remove, modelOptions);
    addDefaultInstanceMethods(newConstructor, save, modelOptions);

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
async function create(options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {
  const constructor = this.constructor;

  const col = constructor.getCollection();

  debug
    .normal(`.create called, dbName: '${constructor[modelSymbols.dbName].name}', found?: ${!!col}, set: %O`, this);

  if (!col) {
    throw new Error(`Database '${constructor[modelSymbols.dbName].name}' not found`);
  }

  const dbObj = this.toDb();
  const result = await col.insertOne(dbObj, options);
  this.id = result.insertedId;
  return result;
}

/**
 * @static Creates an object from a MongoDb document with all of its fields properly mapped based on the [[Model]]'s
 * various decorators (see [[Db]]).
 * @param json The document returned from the Db.
 * @param options An optional [[IFromDbOptions]] object
 * @returns {object} Returns an instantiated object which is an instance of the [[Model]]'s class. Returns null
 * if the `json` parameter is null, undefined or not an object.
 */
function fromDb(json: any, options?: IFromDbOptions): object {
  const modelName = this.name;
  debug.normal(`.fromDb called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  options = options || {};

  const obj = new this();

  const result = mapDbToModel(json, obj, keyMapper.bind(this));

  // make sure the _id field is included as one of the properties
  if (!result._id && json._id) {
    result._id = json._id;
  }

  // make sure _id is ObjectID, if possible
  if (result._id && !(result._id instanceof ObjectID) && ObjectID.isValid(result._id)) {
    result._id = new ObjectID(result._id.toString());
  }

  if (options.strict) {
    pruneNonDbProperties(json, result);
  }

  if (result._id === null) {
    result._id = undefined;
  }

  return result;

  ////////////
  function mapDbToModel(source, target, map, depth = 0) {
    target = target || {};

    if (!source) {
      return source;
    }

    const dbOptionsByFieldName: Map<string, IDbOptions>
      = Reflect.getMetadata(dbSymbols.dbByFieldName, target) || new Map<string, IDbOptions>();

    // iterate over each property of the source json object
    const propertyNames = Object.getOwnPropertyNames(source);
    for (const key of propertyNames) {

      // convert the DB key name to the Model key name
      const mapper = map(key, source[key], dbOptionsByFieldName);
      const model = mapper.model;

      let nextTarget;
      try {
        nextTarget = (model)
          ? Object.assign(new model(), target[mapper.newKey])
          : target[mapper.newKey];
      } catch (err) {
        throw new Error(`Model '${modelName}' has a property '${key}' that defines its model with a value that`
          + ` cannot be constructed`);
      }

      if (shouldRecurse(source[key])) {
        // if the key should be included, recurse into it
        if (mapper.newKey !== undefined) {

          let value = mapDbToModel(source[key], nextTarget, map, ++depth);

          if (model) {
            value = Object.assign(new model(), value);

            if (depth > 0 && (!value.id || !value._id)) { // resolves #106
              value._id = undefined;
            }
          }

          target[mapper.newKey] = value;
        }

      } else {
        // otherwise, map a property that has a primitive value or an ObjectID value
        if (mapper.newKey !== undefined) {
          target[mapper.newKey] = (source[key] !== undefined && source[key] !== null)
            ? source[key]
            : nextTarget; // resolves issue #94
        }
      }
    }

    return target;
  }

  function keyMapper(key: string, value: any, meta: Map<string, IDbOptions>) {
    const dbFieldOptions = (meta) ? meta.get(key) : null;

    return {
      model: ((dbFieldOptions || {}).model),
      newKey: (dbFieldOptions)
        ? dbFieldOptions[dbSymbols.propertyName]
        : ((this[modelSymbols.modelOptions].dbConfig || {} as any).promiscuous)
          ? key
          : undefined
    };
  }

  function pruneNonDbProperties(source, target) {
    const dbOptionsByProperty: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, target);

    const keys = Object.getOwnPropertyNames(target);
    for (const key of keys) {

      const dbOptions = (dbOptionsByProperty) ? dbOptionsByProperty.get(key) || {} : null;
      const fieldName = (dbOptions) ? dbOptions.field || key : key;

      if (!!source && !source.hasOwnProperty(fieldName)) {
        if (key === 'id' && source.hasOwnProperty('_id')) {
          continue;
        }

        delete target[key];

        continue;
      }

      if (typeof target[key] === 'object' && !(target[key] instanceof ObjectID) && target[key] !== null) {
        pruneNonDbProperties(source[fieldName], target[key]);
      }
    }
  }
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
function fromDbArray(jsons: object[], options?: IFromDbOptions): object[] {
  debug.normal(`.fromDbArray called, target '${this.name}'`);

  if (!jsons || !Array.isArray(jsons)) {
    return [];
  }

  const results: object[] = [];
  for (const json of jsons) {
    const obj = this.fromDb(json, options);
    if (obj) {
      results.push(obj);
    }
  }

  return results;
}

/**
 * @static Constructs an `@`Model object from a json object (see [[Json]]).
 * @param json The json object to be unmarshaled into an `@`[[Model]] object.
 * @returns {{}} Returns an instantiated [[Model]] from the provided json. Returns null if the `json` parameter is null,
 * undefined, or not an object.
 */
function fromJson(json: object): object {
  const modelName = this.name;
  debug.normal(`.fromJson called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  const obj = new this();

  return mapJsonToModel(json, obj);

  ////////////
  function mapJsonToModel(jsonSource: any, target: any) {
    target = target || {};

    if (!jsonSource) {
      return jsonSource;
    }

    const propertyNamesByJsonFieldName: Map<string, IJsonOptions>
      = Reflect.getMetadata(jsonSymbols.jsonByFieldName, target) || new Map<string, IJsonOptions>();

    const propertyNamesByDbPropertyName: Map<string, IDbOptions>
      = Reflect.getMetadata(dbSymbols.dbByPropertyName, target) || new Map<string, IDbOptions>();

    // iterate over each property of the source json object
    const propertyNames = Object.getOwnPropertyNames(jsonSource);
    for (const key of propertyNames) {
      // convert the DB key name to the Model key name
      const mapper = keyMapper(key, jsonSource[key], propertyNamesByJsonFieldName, target);

      if (mapper.promiscuous) {
        target[mapper.newKey] = jsonSource[key];
      } else if (shouldRecurse(jsonSource[key])) {

        const dbModel = propertyNamesByDbPropertyName.get(mapper.newKey) || {};

        // if the key should be included, recurse into it
        if (mapper.newKey !== undefined) {
          // use @Json({model:...}) || @Db({model:...})
          const model = mapper.model || (dbModel || {}).model || null;

          // if recurrsing into a model, set that up, otherwise just pass the target in
          let nextTarget;
          try {
            nextTarget = (model)
              ? Object.assign(new model(), target[mapper.newKey])
              : target[mapper.newKey];
          } catch (err) {
            throw new Error(`Model '${modelName}' has a property '${key}' that defines its model with a value that`
              + ` cannot be constructed`);
          }

          let value = mapJsonToModel(jsonSource[key], nextTarget);

          if (model) {
            value = Object.assign(new model(), value);
          }

          target[mapper.newKey] = value;
        }

      } else {
        // otherwise, map a property that has a primitive value or an ObjectID value
        if (mapper.newKey !== undefined) {
          let value = jsonSource[key];
          if ((mapper.newKey === 'id' || mapper.newKey === '_id') && ObjectID.isValid(value)) {
            value = new ObjectID(value);
          }

          target[mapper.newKey] = value;
        }
      }
    }

    return target;
  }

  function keyMapper(key: string, value: any, meta: Map<string, IJsonOptions>, target) {
    const jsonFieldOptions = (meta) ? meta.get(key) : null;

    const model = (jsonFieldOptions || {}).model;
    return {
      model,
      newKey: (jsonFieldOptions)
        ? jsonFieldOptions[jsonSymbols.propertyName]
        : (target[key])
          ? key
          : (key === 'id' || key === '_id')
            ? key
            : undefined,
      promiscuous: (jsonFieldOptions || {} as any).promiscuous || false
    };
  }
}

/**
 * @static Constructs an array of `@`Model objects from an array of json objects.
 * @param json The array of json objects to to be marshaled into an array of `@`[[Model]] objects.
 * @param constructorArgs A variadic list of parameters to be passed to the constructor of the `@`Model object being
 * constructed.
 * @returns [{{}}] Returns an array of instantiated objects based on the [[Model]]'s. Returns null if the `json`
 * parameter is null, undefined, or not an array.
 */
function fromJsonArray(json: object[]): object[] {
  debug.normal(`.fromJsonArray called, target '${this.name}'`);

  const result = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      result.push(this[modelSymbols.fromJson](item));
    }
  }

  return result;
}

/**
 * @static Takes a json object (probably from something like req.body) and maps its fields to db field names.
 * @param json The json object to be transformed.
 * @param model The Model that has the `@`[[Json]] and/or `@`[[Db]] properties that inform how the json object should
 * be transformed.
 * @throws SapiInvalidModelObject if the provided model does not have .fromJson and .toDb methods
 * @returns {any} json object with fields mapped from json fields to db fields.
 */
function fromJsonToDb(json: any, ...constructorArgs: any[]): any {
  const modelName = this.name;
  debug.normal(`.fromJsonToDb called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  return mapJsonToDb(new this(...constructorArgs), json);

  //////////
  function mapJsonToDb(model, jsonSrc, result?) {

    const dbByPropertyName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, model);
    const jsonByPropertyName: Map<string, IJsonOptions> = Reflect.getMetadata(jsonSymbols.jsonByPropertyName, model);

    const isRoot = !!result;
    result = result || {};

    // map id to _id at root
    if (jsonSrc && jsonSrc.id !== undefined && !isRoot) {
      result._id = jsonSrc.id;
    }

    for (const key of jsonByPropertyName.keys()) {
      const dbMeta = (dbByPropertyName) ? dbByPropertyName.get(key) : null;
      const jsonMeta = (jsonByPropertyName) ? jsonByPropertyName.get(key) : null;

      if (!jsonSrc || !jsonMeta || !dbMeta) {
        continue;
      }

      if (shouldRecurse(model[key])) {

        const value = mapJsonToDb(model[key], jsonSrc[jsonMeta.field || key], result[dbMeta.field || key]);

        if (value && Object.keys(value).length > 0) {
          result[dbMeta.field || key] = value;
        }
      } else {

        const value = jsonSrc[jsonMeta.field || key];

        if (value !== undefined && value !== null) {
          result[dbMeta.field || key] = value;
        }
      }
    }

    return result;
  }
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
async function get(params?: IDbGetParams): Promise<object[]> {
  debug.normal(`.get called, dbName '${this[modelSymbols.dbName]}'`);

  const cursor = this.getCursor(params.filter, params.project);

  if (params) {
    if (params.skip) {
      cursor.skip(params.skip);
    }

    if (params.limit) {
      cursor.limit(params.limit);
    }
  }

  const results = await cursor.toArray();

  const options = (params.project) ? {strict: true} : null;

  const objs = [];
  for (const result of results) {
    const obj = this.fromDb(result, options);
    if (obj) {
      objs.push(obj);
    }
  }
  return objs;
}

/**
 * @static Gets a document by its id from the database and builds its corresponding [[Model]] then resolves that object.
 * @param id The id of the document in the database.
 * @param project The fields to project (all if not supplied).
 * @returns {Promise<T>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null
 * if the record is not found in the Db.
 */
async function getById(id: string | ObjectID, project?: any): Promise<any> {
  debug.normal(`.getById called, dbName '${this[modelSymbols.dbName]}'`);
  const cursor = this.getCursorById(id, project);

  const options = (project) ? {strict: true} : null;
  const result = await cursor.next();

  return this.fromDb(result, options);
}

/**
 * @instance Gets the MongoDB `Collection` object associated with this [[Model]] based on the [[IModelOptions.dbConfig]]
 * @static Also available as a static method
 * parameters passed into the [[Model]]'s definition.
 * @returns {Collection}
 */
function getCollection(): Collection {
  // can be called as instance or static method, so get the appropriate context
  const constructor = this[modelSymbols.constructor] || this;

  const db = constructor.getDb();

  if (!db) {
    return null;
  }

  const col = db.collection(constructor[modelSymbols.dbCollection]);

  debug.normal(`.getCollection called, dbName: '${constructor[modelSymbols.dbName]},` +
    ` collection: ${constructor[modelSymbols.dbCollection]}', found?: ${!!col}`);

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
  filter = filter || {};

  const col = this.getCollection();
  debug.normal(`.getCursor called, dbName '${this[modelSymbols.dbName]}', found?: ${!!col}`);

  if (!col) {
    throw new Error(`Database '${this[modelSymbols.dbName]}' not found`);
  }

  // make sure the _id field is an ObjectId
  if (filter._id && !(filter._id instanceof ObjectID) && ObjectID.isValid(filter._id)) {
    filter._id = new ObjectID(filter._id.toString());
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
  debug.normal(`.getCursorById called, dbName '${this[modelSymbols.dbName]}'`);

  return this
    .getCursor({
      _id: (id instanceof ObjectID) ? id : id.toString() || `${id}`
    }, project)
    .limit(1);
}

/**
 * @instance Gets the Mongo `Db` object associated with the connection defined in [[IModelOptions.dbConfig]].
 * @static Also available as a static method
 * @returns {Db}
 */
function getDb(): Db {
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

/**
 * @static Like the [[get]] method, but retrieves only the first result.
 * @param filter A MongoDb query.
 * @param project The fields to project (all if nto supplied).
 * @returns {Promise<any>} Returns a Promise that resolves with an instantiated [[Model]] object. Returns null if the
 * record is not found in the Db.
 */
async function getOne(filter: any, project?: any): Promise<any> {
  const cursor = this.getCursor(filter, project);
  debug.normal(`.getOne called, dbName '${this[modelSymbols.dbName]}'`);

  const result = await cursor
    .limit(1)
    .next();

  const obj = this.fromDb(result);
  return obj;
}

/**
 * @instance Removes the current Model's document from the database.
 * @param options MongoDB CollectionOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
function remove(options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const constructor = this.constructor;
  debug.normal(`.remove called for ${this.id}`);
  return constructor.removeById(this.id, options);
}

/**
 * @static Removes all documents from the database that match the filter criteria.
 * @param filter A MongoDB query.
 * @param options MongoDB CollectionOptions
 * @returns {Promise<DeleteWriteOpResultObject>}
 */
function removeAll(filter: any, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
  const col = this.getCollection();

  debug.normal(`.removeAll called, dbName: '${this[modelSymbols.dbName]}', found?: ${!!col}, id: %O`, this.id);

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
function removeById(id: any, options?: CollectionOptions): Promise<DeleteWriteOpResultObject> {
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

/**
 * @instance Performs a MongoDB updateOne if the current [[Model]] has an Id.
 * @param changeSet Expects properties to already be mapped to db field names. Limits the update to just
 * the fields included in the changeset. For example a changeset of:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * would cause only the `firstName` field to be updated. If the `changeSet` parameter is not provided,
 * `save` will assume the entire [[Model]] is the changeset (obeying the various decorators like [[Db]]).
 * @param options The MongoDB ReplaceOneOptions. If you want to set this, but not the `set`, then pass null into `set`.
 * @returns {any}
 */
async function save(changeSet?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {
  const constructor = this.constructor;

  const col = constructor.getCollection();

  debug.normal(`.save called, dbName: '${constructor[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, changeSet);

  if (!col) {
    throw new Error(`Database '${constructor[modelSymbols.dbName]}' not found`);
  }

  if (!this.id) {
    return Promise.reject(new SapiMissingIdErr('Model missing id field, cannot save. Did you mean ' +
      'to use create?', this));
  }

  const dbObj = changeSet || this.toDb(this);
  delete dbObj._id;
  delete dbObj.id;

  const result = await col.updateOne({_id: this.id}, {$set: dbObj}, options);

  if (changeSet) {
    const modelMappedChangeSet = this.constructor.fromDb(changeSet, {strict: true});
    for (const key of Object.getOwnPropertyNames(modelMappedChangeSet)) {
      if (key === '_id' || key === 'id') {
        continue;
      }
      this[key] = modelMappedChangeSet[key];
    }
  }
  return result;
}

/**
 * @instance Builds and returns a change set object with its fields mapped based on decorators like [[Db]]. The
 * resulting change set object is what's persisted to the database.
 * @param changeSet The change set. For example:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * This change set would cause only the `firstName` field to be updated. If the `set` parameter is not provided,
 * `toDb` will assume the entire [[Model]] is the change set (obeying the various decorators like [[Db]]).
 *
 * Nested objects are supported. Each property that is an object (except for ObjectID properties) needs to have its
 * own class declared. The properties classes that represent sub-documents, obey the `@`[[Db]] and `@`[[Json]] decorator
 * rules.
 *
 * @returns {{_id: (any|ObjectID|number)}}
 */
function toDb(changeSet?: any): object {
  const constructor = this[modelSymbols.constructor] || this;

  const modelOptions = constructor[modelSymbols.modelOptions];
  debug.normal(`.toDb called, target '${constructor.name}'`);

  changeSet = changeSet || this;

  const dbObj = mapModelToDb(changeSet);

  delete (dbObj as any).id;
  if (!(dbObj as any)._id && this._id) {
    (dbObj as any)._id = this._id;
  }

  return dbObj;

  //////////
  function mapModelToDb(source, depth = 0) {

    const result = {} as any;
    if (!source) {
      return;
    }

    const dbOptionsByPropertyName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, source);

    // iterate over each property
    for (const key of Object.getOwnPropertyNames(source)) {

      if (shouldRecurse(source[key])) {

        const aNewKey = keyMapper(key, source[key], dbOptionsByPropertyName);
        if (aNewKey !== undefined) {
          const value = mapModelToDb(source[key], ++depth);
          result[aNewKey] = value;
        }

        continue;
      }

      const newKey = keyMapper(key, source[key], dbOptionsByPropertyName);
      if (newKey !== undefined) {
        result[newKey] = source[key];
      }
    }

    if (depth > 0 && !result.id) { // resolves #106
      delete result.id;
    }

    if (depth > 0 && !result._id) { // resolves #106
      delete result._id;
    }

    if (depth > 0 && (result._id && result.id)) { // resolves #106
      delete result.id;
    }

    return result;
  }

  function keyMapper(key, value, dbMeta) {

    if (!dbMeta) {
      dbMeta = constructor[dbSymbols.dbByPropertyName];
    }

    let fieldName;
    // if there's @Db meta data on the property
    if (dbMeta && dbMeta.get) {
      const dbOptions = (dbMeta.get(key)) as IDbOptions;

      if ((dbOptions || {}).field) {
        // if there's specifically a @Db('fieldName') - i.e., there's a declared field name
        fieldName = dbOptions.field;
      } else if (dbOptions) {
        // if there's at least an @Db on the property, use the property name for the field name
        fieldName = key;
      }
    }

    // if the model's promiscuous use the property name for the field name if @Db wasn't found...
    // otherwise leave the field out of the results
    if (!fieldName && (modelOptions.dbConfig || {}).promiscuous) {
      fieldName = key;
    }

    return fieldName;
  }

}

/**
 * @instance Returns the current object as json, respecting the various decorators like [[Db]]
 * @param project is any valid MongoDB projection objected used to determine what fields are included.
 * @returns {{}}
 */
function toJson(): any {
  debug.normal(`.toJson called, target '${this.constructor.name}'`);

  const obj = mapModelToJson(this);
  return obj;

  //////////
  function mapModelToJson(source) {
    const result = {};
    if (!source) {
      return source;
    }

    let jsonFieldNamesByProperty: Map<string, IJsonOptions>
      = Reflect.getMetadata(jsonSymbols.jsonByPropertyName, source);

    jsonFieldNamesByProperty = jsonFieldNamesByProperty || new Map<string, IJsonOptions>();

    const dbOptionsByPropertyName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, source);

    const privateFields: Map<string, string>
      = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, source);

    // iterate over each property
    for (const key of Object.getOwnPropertyNames(source)) {

      if (typeof source[key] === 'function') {
        continue;
      }

      // don't include _id since the model already has id property which is the same as _id
      if (key === '_id') {
        continue;
      }

      if (dbOptionsByPropertyName) {
        const dbOptions = dbOptionsByPropertyName.get(key);

        if ((dbOptions || {}).private) {
          continue;
        }
      }

      const override = (privateFields) ? privateFields.get(key) : null;

      // do the function test for private otherwise do the boolean test
      if (override && typeof source[override] === 'function' && !source[override]()) {
        continue;
      } else if (override && !source[override]) {
        continue;
      }

      if (shouldRecurse(source[key])) {
        const aNewKey = keyMapper(key, source[key], jsonFieldNamesByProperty);

        if (aNewKey !== undefined) {
          const value = mapModelToJson(source[key]);
          result[aNewKey] = value;
        }

        continue;
      }

      const newKey = keyMapper(key, source[key], jsonFieldNamesByProperty);
      if (newKey !== undefined) {
        result[newKey] = source[key];
      }
    }

    return result;
  }

  function keyMapper(key, value, jsonMeta: Map<string, IJsonOptions>) {
    const options = (jsonMeta) ? jsonMeta.get(key) || {} : {};
    return options.field || key;
  }
}

/**
 * @instance Returns the current [[Model]] as a json string, respecting the various decorators like [[Db]]
 * @param replacer See JavaScript's standard `JSON.stringify`.
 * @param space See JavaScript's standard `JSON.stringify`.
 * @returns {string}
 */
function toJsonString(replacer?: () => any | Array<string | number>, space?: string | number): string {
  debug.normal(`.toJsonString called, target '${this.constructor.name}'`);
  return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
}
