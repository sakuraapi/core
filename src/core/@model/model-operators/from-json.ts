import { ObjectID } from 'mongodb';
import { IContext, shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { formatFromJsonSymbols, FromJsonHandler } from '../from-json';
import { IJsonOptions, jsonSymbols } from '../json';
import { debug } from './index';
import { decode as urlBase64Decode } from 'urlsafe-base64';
import { createDecipheriv } from 'crypto';
import { modelSymbols } from '../model';

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
export function fromJson<T = any>(json: T, context: string | IContext = 'default'): any {
  const modelName = (this || {} as any).name;
  debug.normal(`.fromJson called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  const ctx = (typeof context === 'string')
    ? {context}
    : context;
  ctx.context = ctx.context || 'default';

  const obj = new this();

  let resultModel = mapJsonToModel(json, obj);

  // @FromJson
  const formatFromJsonMeta = Reflect.getMetadata(formatFromJsonSymbols.functionMap, resultModel);
  if (formatFromJsonMeta) {
    const formatters: FromJsonHandler[] = [
      ...formatFromJsonMeta.get(ctx.context) || [],
      ...formatFromJsonMeta.get('*') || []
    ];
    for (const formatter of formatters) {
      resultModel = formatter(json, resultModel, ctx.context);
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
    const jsonFieldNames = Object.getOwnPropertyNames(jsonSource);
    for (const key of jsonFieldNames) {

      let jsonFieldOptions = propertyNamesByJsonFieldName.get(`${key}:${ctx.context}`);
      let jsonFieldOptionsStar = propertyNamesByJsonFieldName.get(`${key}:*`);

      const hasOptions = !!jsonFieldOptions || !!jsonFieldOptionsStar;
      jsonFieldOptions = jsonFieldOptions || {};
      jsonFieldOptionsStar = jsonFieldOptionsStar || {};

      const propertyName = jsonFieldOptions[jsonSymbols.propertyName] || jsonFieldOptionsStar[jsonSymbols.propertyName];

      const newKey = (hasOptions)
        ? propertyName
        : (target[key])
          ? key
          : (key === 'id' || key === '_id')
            ? key
            : undefined;

      // convert the field name to the Model property name
      const dbModel = propertyNamesByDbPropertyName.get(newKey) || {};
      // use @Json({model:...}) || @Db({model:...})
      const model = jsonFieldOptions.model || jsonFieldOptionsStar.model || (dbModel || {}).model || null;

      // if recursing into a model, set that up, otherwise just pass the target in
      let nextTarget;
      try {
        nextTarget = (model)
          ? Object.assign(new model(), target[newKey])
          : target[newKey];
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
        if (newKey !== undefined) {

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
        if (newKey !== undefined) {
          value = processEncryption(jsonSource[key], target);
          const type = jsonFieldOptions.type || jsonFieldOptionsStar.type || null;
          if ((type === 'id' || (newKey === 'id' || newKey === '_id')) && ObjectID.isValid(value)) {
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

      target[newKey] = value;

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

    return target;
  }
}


function decrypt(value: string, cipherKey: string): any {
  cipherKey = cipherKey || '';

  const parts = (value && value.split) ? value.split('.') : [];

  if (parts.length !== 3) {
    throw new Error(`@Json invalid value for decryption ${value}`);
  }

  const v = urlBase64Decode(parts[0]);
  const hmac = urlBase64Decode(parts[1]);
  const iv = urlBase64Decode(parts[2]);

  let buff: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', cipherKey, iv);
    decipher.setAuthTag(hmac);

    buff = Buffer.concat([
      decipher.update(v),
      decipher.final()
    ]);

    return JSON.parse(buff.toString('utf8'));
  } catch (err) {
    return buff.toString('utf8');
  }
}
