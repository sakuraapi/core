import { shouldRecurse } from '../../helpers';
import {
  dbSymbols,
  IDbOptions
} from '../db';
import { formatToJsonSymbols } from '../format-to-json';
import {
  IJsonOptions,
  jsonSymbols
} from '../json';
import { privateSymbols } from '../private';
import { debug } from './index';

/**
 * @instance Returns the current object as json, respecting the various decorators like [[Db]]. Supports '*' context. If
 * you provide both a specific context and a '*' context, the specific options win and fall back to '*' options
 * (if any). In the case of a formatter, the more specific context formatter is run before the '*' formatter, but both
 * run.
 * @param context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @returns {{}}
 */
export function toJson(context = 'default'): any {
  const modelName = (this.constructor || {} as any).name;
  debug.normal(`.toJson called, target '${modelName}'`);

  let json = mapModelToJson(this);

  // @FormatToJson
  const formatToJson = Reflect.getMetadata(formatToJsonSymbols.functionMap, this);
  if (formatToJson) {
    const formatters = [
      ...formatToJson.get(context) || [],
      ...formatToJson.get('*') || []
    ];
    for (const formatter of formatters) {
      json = formatter(json, this, context);
    }
  }

  return json;

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

    const privateFields: Map<string, boolean> = Reflect
        .getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, source)
      || new Map<string, boolean>();

    // iterate over each property
    for (const key of Object.getOwnPropertyNames(source)) {

      const options = jsonFieldNamesByProperty.get(`${key}:${context}`) || {};
      const optionsStar = jsonFieldNamesByProperty.get(`${key}:*`) || {};

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

      // skip if the field is private in this context
      const isPrivate = privateFields.get(`${key}:${context}`) || privateFields.get(`${key}:*`);
      if (isPrivate) {
        continue;
      }

      if (shouldRecurse(source[key])) {
        const aNewKey = keyMapper(key, source[key], options, optionsStar);

        if (aNewKey !== undefined) {
          result[aNewKey] = mapModelToJson(source[key]);
        }

        continue;
      }

      const newKey = keyMapper(key, source[key], options, optionsStar);
      if (newKey !== undefined) {
        let value = source[key];

        // check for @json({formatToJson})
        if (options.formatToJson) {
          value = options.formatToJson(value, key);
        }
        if (optionsStar.formatToJson) {
          value = optionsStar.formatToJson(value, key);
        }

        result[newKey] = value;
      }
    }

    return result;
  }

  function keyMapper(key, value, options: IJsonOptions, optionsStar: IJsonOptions) {
    return options.field || optionsStar.field || key;
  }
}
