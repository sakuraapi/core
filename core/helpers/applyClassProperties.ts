// maintain intanceof's behavior and cary over static properties / methods
// newConstructor.prototype = target.prototype;
let skip = ['length', 'name'];
export function applyClassProperties(newConstructor, originalTarget) {
  Reflect.ownKeys(originalTarget).forEach((property: any) => {
    if (skip.indexOf((typeof property === 'symbol') ? property.toString() : property) > -1) return;
    newConstructor[property] = originalTarget[property];
  });
}
