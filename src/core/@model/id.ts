export const idSymbols = {
  idByPropertyName: Symbol('sakuraApiIdByPropertyName')
};

/**
 * @decorator `@Id` informs `@`[[Model]] which model property represents `_id` from MongoDB. If `@Id` is not
 * specified, a property `id` will be created for your model.
 *
 * Don't use this on sub documents that need an id. Instead, decorate sub documents with @Db.
 */
export function Id(): (target: any, key: string) => void {

  return (target: any, key: string) => {

    const existing = Reflect.getMetadata(idSymbols.idByPropertyName, target);
    if (existing) {
      throw new Error(`${target.constructor.name} is trying to use @Id on property ${key}, ` +
        `but it has already been defined on ${existing}`);
    }

    Reflect.defineMetadata(idSymbols.idByPropertyName, key, target);
  };
}
