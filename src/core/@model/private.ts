export const privateSymbols = {
  sakuraApiPrivatePropertyToFieldNames: Symbol('sakuraApiPrivatePropertyToFieldNames')
};

/**
 * Decorates a [[Model]] property and signals SakuraApi to not include that property
 * when generating a json representation of the model.
 *
 * You can include multiple `@Private` decorators to a property with different contexts.
 *
 * ### Example
 * <pre>
 * <span>@</span>Model()
 * class User {
 *    <span>@</span>Private()
 *    password: string = '';
 * }
 * </pre>
 * @param context Sets the context under which this @Json applies (see [[IJsonOptions.context]])
 */
export function Private(context = 'default') {

  return (target: any, key: string) => {

    let metaPropertyFieldMap: Map<string, boolean>
      = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, target);

    if (!metaPropertyFieldMap) {
      metaPropertyFieldMap = new Map<string, boolean>();
      Reflect.defineMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, metaPropertyFieldMap, target);
    }

    metaPropertyFieldMap.set(`${key}:${context}`, true);
  };
}
