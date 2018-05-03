import { ObjectID } from 'mongodb';
import { shouldRecurse } from '../../helpers';
import {
  dbSymbols,
  IDbOptions
} from '../db';
import { formatFromJsonSymbols, FromJsonHandler } from '../from-json';
import {
  IJsonOptions,
  jsonSymbols
} from '../json';
import { debug } from './index';

/**
 * @static Constructs an `@`Model object from a json object (see [[Json]]). Supports '*' context. If you provide both
 * a specific context and a '*' context, the specific options win and fall back to '*' options (if any). In the case
 * of formatter, the more specific context formatter is run before the '*' formatter, but both run.
 *
 * @param json The json object to be unmarshaled into an `@`[[Model]] object.
 * @param context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @returns any Returns an instantiated [[Model]] from the provided json. Returns null if the `json` parameter is null,
 * undefined, or not an object.
 */
export function fromJson<T = any>(json: T, context = 'default'): any {
  const modelName = (this || {} as any).name;
  debug.normal(`.fromJson called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  const obj = new this();

  let resultModel = mapJsonToModel(json, obj);

  // @FromJson
  const formatFromJsonMeta = Reflect.getMetadata(formatFromJsonSymbols.functionMap, resultModel);
  if (formatFromJsonMeta) {
    const formatters: FromJsonHandler[] = [
      ...formatFromJsonMeta.get(context) || [],
      ...formatFromJsonMeta.get('*') || []
    ];
    for (const formatter of formatters) {
      resultModel = formatter(json, resultModel, context);
    }
  }

  return resultModel;

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

      // convert the field name to the Model property name
      const meta = getMeta(key, jsonSource[key], propertyNamesByJsonFieldName, target);
      const dbModel = propertyNamesByDbPropertyName.get(meta.newKey) || {};
      const model = meta.model || (dbModel || {}).model || null; // use @Json({model:...}) || @Db({model:...})

      // if recursing into a model, set that up, otherwise just pass the target in
      let nextTarget;
      try {
        nextTarget = (model)
          ? Object.assign(new model(), target[meta.newKey])
          : target[meta.newKey];
      } catch (err) {
        throw new Error(`Model '${modelName}' has a property '${key}' that defines its model with a value that`
          + ` cannot be constructed`);
      }

      let value;
      if (meta.promiscuous) {
        value = jsonSource[key];
      } else if (model || shouldRecurse(jsonSource[key])) {

        // if the key should be included, recurse into it
        if (meta.newKey !== undefined) {

          if (Array.isArray(jsonSource[key])) {

            const values = [];

            for (const src of jsonSource[key]) {
              values.push(Object.assign(new model(), mapJsonToModel(src, nextTarget)));
            }
            value = values;

          } else {

            value = mapJsonToModel(jsonSource[key], nextTarget);
            if (model) {
              value = Object.assign(new model(), value);
            }
          }
        }

      } else {
        // otherwise, map a property that has a primitive value or an ObjectID value
        if (meta.newKey !== undefined) {
          value = jsonSource[key];
          if ((meta.newKey === 'id' || meta.newKey === '_id') && ObjectID.isValid(value)) {
            value = new ObjectID(value);
          }
        }
      }

      // @json({formatFromJson})
      if (meta.formatFromJson) {
        value = meta.formatFromJson(value, key);
      }
      if (meta.formatFromJsonStar) {
        value = meta.formatFromJsonStar(value, key);
      }

      target[meta.newKey] = value;
    }

    return target;
  }

  function getMeta(key: string, value: any, meta: Map<string, IJsonOptions>, target) {
    let jsonFieldOptions = (meta) ? meta.get(`${key}:${context}`) : null;
    let jsonFieldOptionsStar = (meta) ? meta.get(`${key}:*`) : null;

    const hasOptions = !!jsonFieldOptions || !!jsonFieldOptionsStar;

    jsonFieldOptions = jsonFieldOptions || {};
    jsonFieldOptionsStar = jsonFieldOptionsStar || {};

    const model = jsonFieldOptions.model || jsonFieldOptionsStar.model;
    const propertyName = jsonFieldOptions[jsonSymbols.propertyName] || jsonFieldOptionsStar[jsonSymbols.propertyName];
    const promiscuous = jsonFieldOptions.promiscuous || jsonFieldOptionsStar.promiscuous || false;

    return {
      formatFromJson: jsonFieldOptions.fromJson,
      formatFromJsonStar: jsonFieldOptionsStar.fromJson,
      model,
      newKey: (hasOptions)
        ? propertyName
        : (target[key])
          ? key
          : (key === 'id' || key === '_id')
            ? key
            : undefined,
      promiscuous
    };
  }
}
