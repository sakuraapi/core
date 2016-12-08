export function construct(constructor, args) {
  let c: any = function () {
    return new constructor(...args);
  };
  c.prototype = constructor.prototype;

  return new c();
}
