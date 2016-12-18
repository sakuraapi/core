/** @module core/@model/json */

/**
 * The symbols used by Reflect to store `@Json()` metadata for use by `@Module`.
 */
export const jsonSymbols = {
  sakuraApiJsonPropertyToFieldNames: Symbol('sakuraApiJsonPropertyToFieldNames'),
  sakuraApiJsonFieldToPropertyNames: Symbol('sakuraApiJsonFieldToPropertyNames')
};

/**
 * Decorates properties in an `@Model` class to alias its properties to json (`obj.toJson()`) and
 * from json (`Obj.fromJson(json)`).
 *
 * ### Example
 * <pre>
 * import {Model, Json} from 'sakuraapi';
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
 * @param fieldName The alias you want to use instead of the property name when marshalling to json.
 * @returns {(target:any, key:string)=>undefined}
 */
export function Json(fieldName: string) {

  return function (target: any, key: string) {

    let metaPropertyFieldMap: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonPropertyToFieldNames, target);
    if (!metaPropertyFieldMap) {
      metaPropertyFieldMap = new Map<string ,string>();
      Reflect.defineMetadata(jsonSymbols.sakuraApiJsonPropertyToFieldNames, metaPropertyFieldMap, target);
    }
    metaPropertyFieldMap.set(key, fieldName);

    let metaFieldPropertyMap: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonFieldToPropertyNames, target);
    if (!metaFieldPropertyMap) {
      metaFieldPropertyMap = new Map<string ,string>();
      Reflect.defineMetadata(jsonSymbols.sakuraApiJsonFieldToPropertyNames, metaFieldPropertyMap, target);
    }
    metaFieldPropertyMap.set(fieldName, key);
  }
}
