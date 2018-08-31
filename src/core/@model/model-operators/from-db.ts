import { ObjectID } from 'mongodb';
import { shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { idSymbols } from '../id';
import { IFromDbOptions, modelSymbols } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';
import { debug } from './';

interface IKeyMapperResult {
  model: ReturnType<typeof SapiModelMixin>;
  newKey: string;
}

/**
 * @static Creates an object from a MongoDb document with all of its fields properly mapped based on the [[Model]]'s
 * various decorators (see [[Db]]).
 * @param json The document returned from the Db.
 * @param options An optional [[IFromDbOptions]] object
 * @returns {object} Returns an instantiated object which is an instance of the [[Model]]'s class. Returns null
 * if the `json` parameter is null, undefined or not an object.
 */
export function fromDb<T = InstanceType<ReturnType<typeof SapiModelMixin>>>(json: any, options?: IFromDbOptions): T {
  const modelName = this.name;
  debug.normal(`.fromDb called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  options = options || {};

  const result = mapDbToModel.call(this, json, new this());

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
}

function mapDbToModel(this: ReturnType<typeof SapiModelMixin>,
                      json: { [key: string]: any },
                      model: InstanceType<ReturnType<typeof SapiModelMixin>>,
                      isChild = false) {

  model = model || {} as InstanceType<ReturnType<typeof SapiModelMixin>>;

  if (!json) {
    return json;
  }

  const dbOptionsByFieldName: Map<string, IDbOptions>
    = Reflect.getMetadata(dbSymbols.dbByFieldName, model) || new Map<string, IDbOptions>();

  // iterate over each property of the source json object
  const propertyNames = Object.getOwnPropertyNames(json);
  for (const key of propertyNames) {

    // convert the DB key name to the Model key name
    const keyMeta = keyMapper.call(this, key, json[key], dbOptionsByFieldName);

    const subModel = keyMeta.model;

    let nextModel;
    try {
      nextModel = (subModel)
        ? Object.assign(new subModel(), model[keyMeta.newKey])
        : model[keyMeta.newKey];
    } catch (err) {
      throw new Error(`Model '${this.name}' has a property '${key}' that defines its model with a value that`
        + ` cannot be constructed`);
    }

    // if it's a (subModel || something requiring recurssing) && the field should be included in the model
    if ((subModel || shouldRecurse(json[key])) && (keyMeta.newKey !== undefined)) {

      let value;
      if (Array.isArray(json[key])) {
        // shouldRecurse excludes Arrays so this is a model based sub document array
        const values = [];

        for (const jsonSrc of json[key]) {

          const newModel = new subModel();

          values.push(Object.assign(newModel, mapDbToModel.call(newModel.constructor, jsonSrc, nextModel)));

          nextModel = (subModel)
            ? Object.assign(new subModel(), model[keyMeta.newKey])
            : model[keyMeta.newKey];
        }
        value = values;

      } else {
        if (subModel) {
          const newModel = new subModel();
          value = Object.assign(newModel, mapDbToModel.call(newModel.constructor, json[key], nextModel, true));
        } else {
          value = mapDbToModel.call(this, json[key], nextModel, true);
        }
      }

      model[keyMeta.newKey] = value;

    } else if (keyMeta.newKey !== undefined) {
      // otherwise, map a property that has a primitive value or an ObjectID value
      model[keyMeta.newKey] = (json[key] !== undefined && json[key] !== null)
        ? json[key]
        : nextModel; // resolves issue #94

    } else if (key === '_id') {
      const idProperty = Reflect.getMetadata(idSymbols.idByPropertyName, model);
      model._id = (idProperty)
        ? ObjectID.isValid(json[key]) ? new ObjectID(json[key]) : undefined
        : undefined;
    }
  }

  return model;
}

function keyMapper(this: ReturnType<typeof SapiModelMixin>,
                   key: string,
                   value: any,
                   meta: Map<string, IDbOptions>): IKeyMapperResult {

  const dbFieldOptions = (meta) ? meta.get(key) : null;

  const promiscuous = (this[modelSymbols.modelOptions] || {} as any).promiscuous
    || ((this[modelSymbols.modelOptions] || {} as any).dbConfig || {} as any).promiscuous;
  const model = ((dbFieldOptions || {}).model);

  return {
    model,
    newKey: (dbFieldOptions)
      ? dbFieldOptions[dbSymbols.propertyName]
      : promiscuous
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
