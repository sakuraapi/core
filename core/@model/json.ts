/**
 * The symbols used by Reflect to store `@Json()` metadata for use by `@Module`. These symbols are not considered
 * part of the API contract and may change or be removed without notice on patch releases.
 */
export const jsonSymbols = {
  sakuraApiDbFieldToPropertyNames: Symbol('sakuraApiJsonFieldToPropertyNames'),
  sakuraApiDbPropertyToFieldNames: Symbol('sakuraApiJsonPropertyToFieldNames')
};

/**
 * Decorates properties in an `@`[[Model]] class to describe how a property will be marshaled to json
 * (`ModelObject.toJson()`) and from json (`modelObject.fromJson(json)`).
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
 * @returns Returns a function that is used internally by the framework.
 */
export function Json(fieldName: string): (target: any, key: string) => void {

  return (target: any, key: string) => {

    let metaPropertyFieldMap: Map<string, string>
      = Reflect.getMetadata(jsonSymbols.sakuraApiDbPropertyToFieldNames, target);

    if (!metaPropertyFieldMap) {
      metaPropertyFieldMap = new Map<string, string>();
      Reflect.defineMetadata(jsonSymbols.sakuraApiDbPropertyToFieldNames, metaPropertyFieldMap, target);
    }
    metaPropertyFieldMap.set(key, fieldName);

    let metaFieldPropertyMap: Map<string, string>
      = Reflect.getMetadata(jsonSymbols.sakuraApiDbFieldToPropertyNames, target);

    if (!metaFieldPropertyMap) {
      metaFieldPropertyMap = new Map<string, string>();
      Reflect.defineMetadata(jsonSymbols.sakuraApiDbFieldToPropertyNames, metaFieldPropertyMap, target);
    }
    metaFieldPropertyMap.set(fieldName, key);
  };
}
