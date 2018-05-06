import { IContext, shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { IJsonOptions, jsonSymbols } from '../json';
import { privateSymbols } from '../private';
import { formatToJsonSymbols, ToJsonHandler } from '../to-json';
import { debug } from './index';

/**
 * @instance Returns the current object as json, respecting the various decorators like [[Db]]. Supports '*' context. If
 * you provide both a specific context and a '*' context, the specific options win and fall back to '*' options
 * (if any). In the case of a formatter, the more specific context formatter is run before the '*' formatter, but both
 * run.
 * @param {string | IContext} context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @returns {{}}
 */
export function toJson(context: string | IContext = 'default'): any {

  const ctx = (typeof context === 'string')
    ? {context}
    : context;
  ctx.context = ctx.context || 'default';

  const modelName = (this.constructor || {} as any).name;
  debug.normal(`.toJson called, target '${modelName}'`);

  let json = mapModelToJson(this);

  // @ToJson
  const formatToJson = Reflect.getMetadata(formatToJsonSymbols.functionMap, this);
  if (formatToJson) {
    const formatters: ToJsonHandler[] = [
      ...formatToJson.get(ctx.context) || [],
      ...formatToJson.get('*') || []
    ];
    for (const formatter of formatters) {
      json = formatter(json, this, ctx);
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
    const keys = Object.getOwnPropertyNames(source);
    for (const key of keys) {

      const options = jsonFieldNamesByProperty.get(`${key}:${ctx.context}`) || {};
      const optionsStar = jsonFieldNamesByProperty.get(`${key}:*`) || {};
      const dbOptions = (dbOptionsByPropertyName) ? dbOptionsByPropertyName.get(key) || {} : {};

      if (typeof source[key] === 'function') {
        continue;
      }

      // don't include _id since the model already has id property which is the same as _id
      if (key === '_id') {
        continue;
      }

      if (dbOptions.private) {
        continue;
      }

      // skip if the field is private in this context
      const isPrivate = privateFields.get(`${key}:${ctx.context}`) || privateFields.get(`${key}:*`);
      if (isPrivate) {
        continue;
      }

      const model = dbOptions.model || options.model || optionsStar.model || null;
      const newKey = keyMapper(key, source[key], options, optionsStar);

      let value;
      if (model || shouldRecurse(source[key])) {

        if (Array.isArray(source[key])) {

          const values = [];
          for (const src of source[key]) {
            values.push(mapModelToJson(src));
          }
          value = values;

        } else if (newKey !== undefined) {

          value = mapModelToJson(source[key]);

        }

      } else if (newKey !== undefined) {

        value = source[key];

      }

      // check for @json({toJson})
      if (options.toJson) {
        value = options.toJson(value, key, ctx);
      }
      if (optionsStar.toJson) {
        value = optionsStar.toJson(value, key, ctx);
      }

      result[newKey] = value;
    }

    return result;
  }

  function keyMapper(key, value, options: IJsonOptions, optionsStar: IJsonOptions) {
    return options.field || optionsStar.field || key;
  }
}
