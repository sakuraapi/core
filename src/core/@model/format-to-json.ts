export const formatToJsonSymbols = {
  functionMap: Symbol('functionMap')
};

export type ToJsonFormatter = (json: any, model: any, context: string) => any;

export function FormatToJson(context = 'default') {
  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {
    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    const meta = getMetaDataMap(target, formatToJsonSymbols.functionMap);

    let formatters: ToJsonFormatter[] = meta.get(context);
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
  function getMetaDataMap(source, symbol): Map<string, ToJsonFormatter[]> {
    let map: Map<string, ToJsonFormatter[]> = Reflect.getMetadata(symbol, source);

    if (!map) {
      map = new Map<string, ToJsonFormatter[]>();
      Reflect.defineMetadata(symbol, map, source);
    }

    return map;
  }
}
