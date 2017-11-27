/* tslint:disable:variable-name */

export interface IDefaultMethodsOptions {
  suppressInjection?: string[];
}

/**
 * @internal This is an internal helper function used by the SakuraApi framework. It's behavior is not part of
 * the official API and as a result, that behavior may break without notice. This is not part of the API contract.
 */
export function addDefaultInstanceMethods(target: any, fn: (...any) => any,
                                          options?: IDefaultMethodsOptions) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(fn.name) > -1) {
    return;
  }

  if (!target.prototype[fn.name]) {
    target.prototype[fn.name] = fn;
  }
}

/**
 * @internal This is an internal helper function used by the SakuraApi framework. It's behavior is not part of the
 * official API and as a result, that behavior may break without notice. This is not part of the API contract.
 */
export function addDefaultStaticMethods(target: any, fn: (...any) => any,
                                        options?: IDefaultMethodsOptions) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(fn.name) > -1) {
    return;
  }

  if (!target[fn.name]) {

    target[fn.name] = fn;
  }
}

/* tslint:enable:variable-name */
