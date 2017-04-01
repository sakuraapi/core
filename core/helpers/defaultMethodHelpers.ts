/* tslint:disable:variable-name */

/**
 * This is an internal helper function used by the SakuraApi framework. It's behavior is not part of the
 * official API and as a result, that behavior may break without notice.
 */
export function addDefaultInstanceMethods(target: any, functionName: string, fn: (...any) => any, options?: any) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target.prototype[functionName]) {
    target.prototype[functionName] = fn;
  }
}

/**
 * This is an internal helper function used by the SakuraApi framework. It's behavior is not part of the
 * official API and as a result, that behavior may break without notice.
 */
export function addDefaultStaticMethods(target: any, functionName: string, fn: (...any) => any, options?: any) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target[functionName]) {
    target[functionName] = fn;
  }
}
/* tslint:enable:variable-name */
