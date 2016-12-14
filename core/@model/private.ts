export const privateSymbols = {
  sakuraApiPrivatePropertyToFieldNames: Symbol('sakuraApiPrivatePropertyToFieldNames')
};

export function Private(override?: string | boolean) {
  override = <any>override || defaultOverride;

  return function (target: any, key: string) {

    let metaPropertyFieldMap: Map<string, any> = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, target);
    if (!metaPropertyFieldMap) {
      metaPropertyFieldMap = new Map<string, any>();
      Reflect.defineMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, metaPropertyFieldMap, target);
    }

    metaPropertyFieldMap.set(key, override);
  }
}

function defaultOverride() {
  return false;
}
