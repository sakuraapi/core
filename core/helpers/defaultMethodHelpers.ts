export function addDefaultInstanceMethods(target: any, functionName: string, fn: (any) => any, options?: any) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target.prototype[functionName]) {
    target.prototype[functionName] = fn.bind(target);
  }
}

export function addDefaultStaticMethods(target: any, functionName: string, fn: (any) => any, options?: any) {

  if (options && options.suppressInjection && options.suppressInjection.indexOf(functionName) > -1) {
    return;
  }

  if (!target[functionName]) {
    target[functionName] = fn;
  }
}
