export const formatFromJsonSymbols = {
  functionMap: Symbol('functionMap')
};

export type FromJsonHandler = (json: any, model: any, context: string) => any;

export function FromJson(context = 'default') {
  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {
    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    const meta = getMetaDataMap(target, formatFromJsonSymbols.functionMap);

    let formatters: FromJsonHandler[] = meta.get(context);
    if (!formatters) {
      formatters = [];
      meta.set(context, formatters);
    }

    formatters.push(f);

    return {
      value: f
    };
  };

  /////
  function getMetaDataMap(source, symbol): Map<string, FromJsonHandler[]> {
    let map: Map<string, FromJsonHandler[]> = Reflect.getMetadata(symbol, source);

    if (!map) {
      map = new Map<string, FromJsonHandler[]>();
      Reflect.defineMetadata(symbol, map, source);
    }

    return map;
  }
}
