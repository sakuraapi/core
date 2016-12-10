export function addDefaultInstanceMethods(target: any, functionName: string, fn: (any) => any) {
  if (!target[functionName]) {
    target[functionName] = fn.bind(target);
  }
}

export function addDefaultStaticMethods(target: any, functionName: string, fn: (any) => any) {
  if (!target[functionName]) {
    target[functionName] = fn;
  }
}
