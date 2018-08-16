import { ObjectID } from 'mongodb';
import { shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { IFromDbOptions, modelSymbols } from '../model';
import { debug } from './';

/**
 * @static Creates an object from a MongoDb document with all of its fields properly mapped based on the [[Model]]'s
 * various decorators (see [[Db]]).
 * @param json The document returned from the Db.
 * @param options An optional [[IFromDbOptions]] object
 * @returns {object} Returns an instantiated object which is an instance of the [[Model]]'s class. Returns null
 * if the `json` parameter is null, undefined or not an object.
 */
export function fromDb(json: any, options?: IFromDbOptions): object {
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

      if (model || shouldRecurse(source[key])) {

        // if the key should be included
        if (mapper.newKey !== undefined) {

          let value;
          if (Array.isArray(source[key])) {
            // shouldRecurse excludes Arrays so this is a model based sub document array

            const values = [];

            for (const src of source[key]) {
              values.push(Object.assign(new model(), mapDbToModel(src, nextTarget, map)));
              nextTarget = (model)
                  ? Object.assign(new model(), target[mapper.newKey])
                  : target[mapper.newKey];
            }
            value = values;

          } else {
            value = mapDbToModel(source[key], nextTarget, map, ++depth);

            if (model) {
              value = Object.assign(new model(), value);

              if (depth > 0 && (!value.id || !value._id)) { // resolves #106
                value._id = undefined;
              }
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

  function keyMapper(key: string, value: any, meta: Map<string, IDbOptions>): { model: any, newKey: string } {
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
