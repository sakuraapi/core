import { createCipheriv, randomBytes } from 'crypto';
import { encode as urlBase64Encode } from 'urlsafe-base64';
import { IContext, IProjection, shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { IJsonOptions, jsonSymbols } from '../json';
import { modelSymbols } from '../model';
import { privateSymbols } from '../private';
import { formatToJsonSymbols, ToJsonHandler } from '../to-json';
import { debug } from './index';

const IV_LENGTH = 16;

/**
 * @instance Returns a model as JSON, respecting the various decorators like `@`[[Json]]. Supports '*' context.
 *
 * When there are both `@Json` decorators with a specific context and a `*` contest, the specific context `@Json` options
 * win and fall back to '*' options (if any) for those options that are not defined in the more specific context.
 *
 * In the case of a formatter, the more specific context formatter is run before the '*' formatter, but both run.
 *
 * `toJson` supports projection. It accepts an [[IProjection]] in [[IContext]] on the `projection` field.
 *
 * Projection follows some simple rules:
 *    - use `@Json` field names when projecting
 *    - if you project specific fields with `0` or `false`, those fields are excluded, but all the other fields
 *      are included (including sub documents).
 *    - if you project any field with `1` or `true`, then you are defining an explicit projection. You must define
 *      each field you want to include per level. For example if you have a document with a sub document, and you
 *      project a parent field, everything at the parent level is explicitly projected (but the sub document can
 *      still be either remove specific fields with `0` | `false` or can define explicit fields. (i.e., whether or not
 *      projection is explicit is defined at each document/sub document level.
 *    - unlike MongoDB projection, `toJson` projection does not automatically include the parent document's `id`
 *      if you are explicitly selecting which fields to include.
 *
 * @param {string | IContext} context The optional context to use for marshalling a model from JSON. See [[IJsonOptions.context]].
 * @returns {any} returns a JSON representation of the Model on which `.toJson` was called
 */
export function toJson(context: string | IContext = 'default'): { [key: string]: any } {

  const ctx = (typeof context === 'string')
    ? {context}
    : context;
  ctx.context = ctx.context || 'default';

  const modelName = (this.constructor || {} as any).name;
  debug.normal(`.toJson called, target '${modelName}'`);

  return mapModelToJson(ctx, this, ctx.projection);
}

function mapModelToJson(ctx: IContext, source, projection: IProjection) {

  let jsonObj = {};

  if (!source) {
    return source;
  }

  const dbOptionsByPropertyName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, source);

  const jsonFieldNamesByProperty: Map<string, IJsonOptions> = Reflect
    .getMetadata(jsonSymbols.jsonByPropertyName, source) || new Map<string, IJsonOptions>();

  const privateFields: Map<string, boolean> = Reflect
    .getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, source) || new Map<string, boolean>();

  const inclusiveProjection = isInclusiveProjection(projection);

  // iterate over each property
  const keys = Object.getOwnPropertyNames(source);

  for (const key of keys) {

    const dbOptions = (dbOptionsByPropertyName) ? dbOptionsByPropertyName.get(key) || {} : {};
    const jsonOptions = jsonFieldNamesByProperty.get(`${key}:${ctx.context}`) || {};
    const jsonOptionsStar = jsonFieldNamesByProperty.get(`${key}:*`) || {};

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

    const model = dbOptions.model || jsonOptions.model || jsonOptionsStar.model || null;
    const newKey = keyMapper(key, source[key], jsonOptions, jsonOptionsStar);

    if (skipProjection(inclusiveProjection, projection, newKey)) {
      continue;
    }

    let value;
    if (model || shouldRecurse(source[key])) {

      const subProjection = (projection)
        ? (typeof projection[newKey] === 'object') ? projection[newKey] as IProjection : undefined
        : undefined;

      if (Array.isArray(source[key])) {

        const values = [];
        for (const src of source[key]) {
          values.push(mapModelToJson(ctx, src, subProjection));
        }
        value = values;

      } else if (newKey !== undefined) {

        value = mapModelToJson(ctx, source[key], subProjection);

      }

    } else if (newKey !== undefined) {

      value = source[key];

    }

    // check for @json({toJson})
    if (jsonOptions.toJson) {
      value = jsonOptions.toJson.call(source, value, key, ctx);
    }
    if (jsonOptionsStar.toJson) {
      value = jsonOptionsStar.toJson.call(source, value, key, ctx);
    }

    // check for @json({encrypt})
    if (jsonOptions.encrypt) {
      value = (jsonOptions.encryptor)
        ? jsonOptions.encryptor.call(source, value, key, jsonOptions.key, ctx)
        : encrypt(value, jsonOptions.key || source[modelSymbols.cipherKey]);
    }
    if (jsonOptionsStar.encrypt) {
      value = (jsonOptionsStar.encryptor)
        ? jsonOptionsStar.encryptor.call(source, value, key, jsonOptions.key, ctx)
        : encrypt(value, jsonOptionsStar.key || source[modelSymbols.cipherKey]);
    }

    jsonObj[newKey] = value;

  }

  // @ToJson
  const formatToJson = Reflect.getMetadata(formatToJsonSymbols.functionMap, source);
  if (formatToJson) {
    const formatters: ToJsonHandler[] = [
      ...formatToJson.get(ctx.context) || [],
      ...formatToJson.get('*') || []
    ];
    for (const formatter of formatters) {
      jsonObj = formatter.call(source, jsonObj, source, ctx);
    }
  }

  return jsonObj;
}

function encrypt(value: any, cipherKey: string): string {
  cipherKey = cipherKey || '';

  const iv = randomBytes(IV_LENGTH);
  let cipher;

  try {
    cipher = createCipheriv('aes-256-gcm', cipherKey, iv);

    let v = value;
    if (typeof value === 'object') {
      v = JSON.stringify(v);
    }

    const buff = Buffer.concat([
      cipher.update(v, 'utf8'),
      cipher.final()
    ]);
    const hmac = cipher.getAuthTag();

    return `${urlBase64Encode(buff)}.${urlBase64Encode(hmac)}.${urlBase64Encode(iv)}`;
  } catch (err) {
    throw new Error(`@Json error encrypting ${err}`);
  }
}

function isInclusiveProjection(projection: IProjection) {
  if (projection) {
    const keys = Object.keys(projection);
    for (const key of keys) {
      if (projection[key] === true || projection[key] > 0) {
        return true;
      }
    }
    return false;
  }

  return true;
}

function keyMapper(key, value, options: IJsonOptions, optionsStar: IJsonOptions) {
  return options.field || optionsStar.field || key;
}

function skipProjection(isInclusive: boolean, projection: IProjection, newKey: string): boolean {
  if (!projection) {
    return false;
  }

  return (isInclusive)
    ? projection[newKey] == null || projection[newKey] === false || projection[newKey] < 1
    : projection[newKey] === false || projection[newKey] < 1;
}
