export const privateSymbols = {
  sakuraApiPrivatePropertyToFieldNames: Symbol('sakuraApiPrivatePropertyToFieldNames')
};

/**
 * Decorates a [[Model]] property and signals SakuraApi to not include that property
 * when generating a json representation of the model.
 *
 * ### Example
 * <pre>
 * <span>@</span>Model()
 * class User {
 *    <span>@</span>Private()
 *    password: string = '';
 * }
 * </pre>
 *
 * It's possible to conditionally make a property private by passing in the name (as a string)
 * of a method that returns true or false (true meaning override the privacy setting) or by
 * directly passing in a boolean value.
 *
 * ### Example of Override
 * <pre>
 * <span>@</span>Model()
 * class User {
 *    <span>@</span>Private('hasSsnAccess')
 *    ssn: string = '';
 *
 *    hasSsnAccess() {
 *      return someAclChecker(this, 'ssn_access');
 *    }
 * }
 * </pre>
 */
export function Private(override?: string | boolean) {
  override = override as any || defaultOverride;

  return (target: any, key: string) => {

    let metaPropertyFieldMap: Map<string, any>
      = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, target);

    if (!metaPropertyFieldMap) {
      metaPropertyFieldMap = new Map<string, any>();
      Reflect.defineMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, metaPropertyFieldMap, target);
    }

    metaPropertyFieldMap.set(key, override);
  };
}

/**
 * Used by [[Private]] to assign a default override set to false if an override is not provided by the integrator.
 * This is an internal implementation and can change at any time since it's not an official part of the API.
 */
function defaultOverride() {
  return false;
}
