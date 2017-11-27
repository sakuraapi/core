/**
 * The symbols used by Reflect to store `@Json()` metadata for use by `@Module`. These symbols are not considered
 * part of the API contract and may change or be removed without notice on patch releases.
 */
export const jsonSymbols = {
  jsonByFieldName: Symbol('jsonByFieldName'),
  jsonByPropertyName: Symbol('jsonByPropertyName'),
  propertyName: Symbol('jsonPropertyName')
};

/**
 * Defines the valid options for `@`[[Json]].
 */
export interface IJsonOptions {

  /**
   * An optional `@`[[Model]] decorated class. If provided, the property will be instantiated as a sub document
   * with its default values or the values from the json object. `@`[[Json]] will utilize this same model
   * as the one set in `@`[[Db]] if `model` is not set on this attribute.
   */
  model?: any;

  /**
   * The json field name that is mapped to and from this property when marshalled to and from json with
   * [[Model]].[[toJson]] or [[Model]].[[fromJson]].
   *
   * ### Example
   * <pre>
   *    <span>@</span>Model({...})
   *    export class SomeModel {
   *        <span>@</span>Json({
   *          field: 'fn'
   *        })
   *        firstName: string = '';
   *    }
   * </pre>
   *
   * Explanation: `firstName` property of the `@Model` is mapped to the `fn` field when marshalling this model to/from
   * a json object.
   */
  field?: string;

  /**
   * If true, sub-documents that aren't part of a model will be mapped to the resulting object.
   */
  promiscuous?: boolean;
}

/**
 * Decorates properties in an `@`[[Model]] class to describe how a property will be marshaled to json
 * ([[Model]].[[toJson]]) and from json ([[Model]].[[fromJson]]).
 *
 * ### Example
 * <pre>
 * import {Model, Json} from '@sakuraapi/api';
 * <span/>
 * <span>@</span>Model()
 * class User {
 *    <span>@</span>Json('fn')
 *    firstName: string = 'John';
 *    <span/>
 *    <span>@</span>Json('ln')
 *    lastName: string = 'Adams';
 * }</pre>
 *
 * This will cause `user.toJson()` to return:
 * <pre>
 * {
 *    "fn":"John",
 *    "ln":"Adams"
 * }
 * </pre>
 *
 * And `User.fromJson(json)` will map the json object back to an instantiated `User`.
 *
 * @param jsonOptions sets [[IJsonOptions.field]] when a string is passed.
 * @returns Returns a function that is used internally by the framework.
 */
export function Json(jsonOptions?: IJsonOptions | string): (target: any, key: string) => void {
  const options = (typeof jsonOptions === 'string')
    ? {field: jsonOptions}
    : jsonOptions || {};

  return (target: any, key: string) => {
    options[jsonSymbols.propertyName] = key;

    const metaPropertyFieldMap = getMetaDataMap(target, jsonSymbols.jsonByPropertyName);
    const metaFieldPropertyMap = getMetaDataMap(target, jsonSymbols.jsonByFieldName);

    metaPropertyFieldMap.set(key, options);
    metaFieldPropertyMap.set(options.field || key, options);

    //////////
    function getMetaDataMap(source, symbol): Map<string, IJsonOptions> {

      let map: Map<string, IJsonOptions> = Reflect.getMetadata(symbol, source);

      if (!map) {
        map = new Map<string, IJsonOptions>();
        Reflect.defineMetadata(symbol, map, source);
      }

      return map;
    }
  };
}
