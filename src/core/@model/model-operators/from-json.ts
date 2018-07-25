import { ObjectID } from 'mongodb';
import { decrypt, IContext, shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { formatFromJsonSymbols, FromJsonHandler } from '../from-json';
import { IJsonOptions, jsonSymbols } from '../json';
import { modelSymbols } from '../model';
import { debug } from './index';

export interface IFromJsonOptions {
  /**
   * Defaults false. If true, only the fields included in the source JSON are included in the resulting model.
   * I.e., default Model properties are not included in the resulting model.
   */
  sparse?: boolean;
}

/**
 * @static Constructs an `@`Model object from a json object (see [[Json]]). Supports '*' context. If you provide both
 * a specific context and a '*' context, the specific options win and fall back to '*' options (if any). In the case
 * of formatter, the more specific context formatter is run before the '*' formatter, but both run.
 *
 * @param json The json object to be unmarshaled into an `@`[[Model]] object.
 * @param context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @param options an optional [[IFromJsonOptions]] object
 * @returns any Returns an instantiated [[Model]] from the provided json. Returns null if the `json` parameter is null,
 * undefined, or not an object.
 */
export function fromJson<T = any>(json: T, context: string | IContext = 'default', options: IFromJsonOptions = {}): any {
  const modelName = (this || {} as any).name;
  debug.normal(`.fromJson called, target '${modelName}'`);

  context = context || 'default';

  options = options || {} as IFromJsonOptions;
  options.sparse = options.sparse || false;

  if (!json || typeof json !== 'object') {
    return null;
  }

  const ctx = (typeof context === 'string')
    ? {context}
    : context;

  ctx.context = ctx.context || 'default';

  const target = new this();

  let model = mapJsonToModel(json, target, ctx, modelName, options);

  // @FromJson
  const formatFromJsonMeta = Reflect.getMetadata(formatFromJsonSymbols.functionMap, model);
  if (formatFromJsonMeta) {
    const formatters: FromJsonHandler[] = [
      ...formatFromJsonMeta.get(ctx.context) || [],
      ...formatFromJsonMeta.get('*') || []
    ];
    for (const formatter of formatters) {
      model = formatter(json, model, ctx.context);
    }
  }

  return model;
}

function mapJsonToModel(jsonSource: any, target: any, ctx: any, modelName: string, options: IFromJsonOptions) {
  target = target || {};

  if (!jsonSource) {
    return jsonSource;
  }

  const propertyNamesByJsonFieldName: Map<string, IJsonOptions>
    = Reflect.getMetadata(jsonSymbols.jsonByFieldName, target) || new Map<string, IJsonOptions>();

  const propertyNamesByDbPropertyName: Map<string, IDbOptions>
    = Reflect.getMetadata(dbSymbols.dbByPropertyName, target) || new Map<string, IDbOptions>();

  const modelPropertyNames = [];
  const jsonFieldNames = Object.getOwnPropertyNames(jsonSource);

  // iterate over each property of the source json object
  for (const key of jsonFieldNames) {

    let jsonFieldOptions = propertyNamesByJsonFieldName.get(`${key}:${ctx.context}`);
    let jsonFieldOptionsStar = propertyNamesByJsonFieldName.get(`${key}:*`);

    const hasOptions = !!jsonFieldOptions || !!jsonFieldOptionsStar;
    jsonFieldOptions = jsonFieldOptions || {};
    jsonFieldOptionsStar = jsonFieldOptionsStar || {};

    const propertyName = jsonFieldOptions[jsonSymbols.propertyName] || jsonFieldOptionsStar[jsonSymbols.propertyName];

    const modelPropertyName = (hasOptions)
      ? propertyName
      : (target[key])
        ? key
        : (key === 'id' || key === '_id')
          ? key
          : undefined;

    // track model properties that are explicitly set by the json source to support stripping unset properties
    // when in options.sparse mode
    modelPropertyNames.push(modelPropertyName);

    // convert the field name to the Model property name
    const dbModel = propertyNamesByDbPropertyName.get(modelPropertyName) || {};
    // use @Json({model:...}) || @Db({model:...})
    const model = jsonFieldOptions.model || jsonFieldOptionsStar.model || (dbModel || {}).model || null;

    // if recursing into a model, set that up, otherwise just pass the target in
    let nextTarget;
    try {
      nextTarget = (model)
        ? Object.assign(new model(), target[modelPropertyName])
        : target[modelPropertyName];
    } catch (err) {
      throw new Error(`Model '${modelName}' has a property '${key}' that defines its model with a value that`
        + ` cannot be constructed`);
    }

    let value;
    if (jsonFieldOptions.promiscuous || jsonFieldOptionsStar.promiscuous || false) {

      value = jsonSource[key];

    } else if (model || shouldRecurse(jsonSource[key])) {

      value = processEncryption(jsonSource[key], nextTarget);

      // if the key should be included, recurse into it
      if (modelPropertyName !== undefined) {

        if (Array.isArray(jsonSource[key])) {

          const values = [];

          for (const src of jsonSource[key]) {
            values.push(Object.assign(new model(), mapJsonToModel(src, nextTarget, ctx, modelName, options)));
          }
          value = values;

        } else {

          value = mapJsonToModel(jsonSource[key], nextTarget, ctx, modelName, options);
          if (model) {
            value = Object.assign(new model(), value);
          }
        }
      }

    } else {

      // otherwise, map a property that has a primitive value or an ObjectID value
      if (modelPropertyName !== undefined) {
        value = processEncryption(jsonSource[key], target);
        const type = jsonFieldOptions.type || jsonFieldOptionsStar.type || null;
        if ((type === 'id' || (modelPropertyName === 'id' || modelPropertyName === '_id')) && ObjectID.isValid(value)) {
          value = new ObjectID(value);
        }
      }
    }

    // @json({fromJson})
    if (jsonFieldOptions.fromJson) {
      value = jsonFieldOptions.fromJson.call(target, value, key);
    }
    if (jsonFieldOptionsStar.fromJson) {
      value = jsonFieldOptionsStar.fromJson.call(target, value, key);
    }

    target[modelPropertyName] = value;

    /////
    function processEncryption(val, modelCipher: string) {
      // check for @json({encrypt})
      if (jsonFieldOptions.encrypt) {
        val = (jsonFieldOptions.decryptor)
          ? jsonFieldOptions.decryptor.call(target, val, key, jsonFieldOptions.key, ctx)
          : decrypt(val, jsonFieldOptions.key || modelCipher[modelSymbols.cipherKey]);
      }

      if (jsonFieldOptionsStar.encrypt) {
        val = (jsonFieldOptionsStar.decryptor)
          ? jsonFieldOptionsStar.decryptor.call(target, val, key, jsonFieldOptions.key, ctx)
          : decrypt(val, jsonFieldOptionsStar.key || modelCipher[modelSymbols.cipherKey]);
      }
      return val;
    }
  }

  // strip non-explicitly set fields when options.sparse = true
  if (options.sparse) {
    const keys = Object.keys(target);
    for (const key of keys) {
      if (modelPropertyNames.indexOf(key) === -1) {
        delete target[key];
      }
    }
  }

  return target;
}
