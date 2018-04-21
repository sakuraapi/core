import { shouldRecurse } from '../../helpers';
import {
  dbSymbols,
  IDbOptions
} from '../db';
import {
  IJsonOptions,
  jsonSymbols
} from '../json';
import { debug } from './index';

/**
 * @static Takes a json object (probably from something like req.body) and maps its fields to db field names.
 * @param json The json object to be transformed.
 * @param context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @throws SapiInvalidModelObject if the provided model does not have .fromJson and .toDb methods
 * @returns {any} json object with fields mapped from json fields to db fields.
 */
export function fromJsonToDb(json: any, context = 'default'): any {
  const modelName = (this || {} as any).name;
  debug.normal(`.fromJsonToDb called, target '${modelName}'`);

  if (!json || typeof json !== 'object') {
    return null;
  }

  return mapJsonToDb(new this(), json);

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

    for (const contextKey of jsonByPropertyName.keys()) {

      const jsonMeta = (jsonByPropertyName) ? jsonByPropertyName.get(contextKey) : null;
      const key = jsonMeta[jsonSymbols.propertyName];

      const dbMeta = (dbByPropertyName) ? dbByPropertyName.get(key) : null;

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
