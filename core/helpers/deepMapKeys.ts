/**
 * Recursively maps new keys for a source object.
 *
 * source: any object. If the source is undefined or null, deepMapKeys returns immediately without an error.
 *
 * // a function that receives the key and value of the current entry in an object. Return the mutated key or
 * // if you want the entry left out of the resulting object, return undefined;
 * map: (key, value, meta) => any
 *
 * // a function that receives the key and value of the current entry in an object. Return false if you want to
 * // prevent recursion from occurring when conditions are met. Defaults to true.
 * recurse?: (key, value) => any
 *
 * // an array of symbols with which deepMapKeys will attempt a Reflect.getMetadata on. If there's no result,
 * // there will still be an entry in the resulting meta array (the third parameter passed to the map function). As
 * // a result, make sure you not only test that there's something in the array, make sure it's not undefined.
 * // This is necessary to make sure the resulting meta parameter passed to map has the same number of members as
 * // the metaLookup array so that the integrator can correlate the two arrays.
 * metaLookup?: Symbol[]
 */
export function deepMapKeys(params: {
  source: object,
  map: (k, v, m?: any[]) => any,
  recurse?: (k, v) => boolean,
  metaLookup?: Symbol[]
}) {
  const result = {};
  if (!params.source) {
    return;
  }

  let meta = [];
  if (params.metaLookup && Array.isArray(params.metaLookup)) {
    for (let symbol of params.metaLookup) {
      meta.push(Reflect.getMetadata(symbol, params.source));
    }
  }

  for (let key of Object.getOwnPropertyNames(params.source)) {
    if (typeof params.source[key] === 'object' && ((params.recurse) ? params.recurse(key, params.source[key]) : true)) {

      const newKey = params.map(key, params.source[key], meta);
      if (newKey !== undefined) {
        const value = deepMapKeys({
          source: params.source[key],
          map: params.map,
          recurse: params.recurse,
          metaLookup: params.metaLookup
        });

        result[newKey] = value;
      }

      continue;
    }

    const newKey = params.map(key, params.source[key], meta);
    if (newKey !== undefined) {
      result[newKey] = params.source[key];
    }
  }

  return result;
}
