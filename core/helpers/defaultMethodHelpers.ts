/* tslint:disable:variable-name */

export interface IDefaultMethodsOptions {
  suppressInjection?: string[];
}

/**
 * @warning @internal This is an internal helper function used by the SakuraApi framework. It's behavior is not part of
 * the official API and as a result, that behavior may break without notice.
 * @internal This is not part of the API contract.
 */
export function addDefaultInstanceMethods(target: any, functionName: string, fn: (...any) => any,
                                          options?: IDefaultMethodsOptions) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target.prototype[functionName]) {
    target.prototype[functionName] = fn;
  }
}

/**
 * @warning This is an internal helper function used by the SakuraApi framework. It's behavior is not part of the
 * official API and as a result, that behavior may break without notice.
 * @internal This is not part of the API contract.
 */
export function addDefaultStaticMethods(target: any, functionName: string, fn: (...any) => any,
                                        options?: IDefaultMethodsOptions) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target[functionName]) {

    target[functionName] = fn;
  }
}
/* tslint:enable:variable-name */
