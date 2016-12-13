export const jsonSymbols = {
  sakuraApiJsonPropertyToFieldNames: Symbol('sakuraApiJsonPropertyToFieldNames'),
  sakuraApiJsonFieldToPropertyNames: Symbol('sakuraApiJsonFieldToPropertyNames')
};

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
