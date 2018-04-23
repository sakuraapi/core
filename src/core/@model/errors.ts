// tslint:disable max-classes-per-file
/**
 * Thrown when a Model tries to use a database that isn't defined in the config environment's
 * `dbConnections: [{name:''}]` array.
 */
export class SapiDbForModelNotFound extends Error {

  /**
   * @param modelName
   * @param dbName
   */
  constructor(modelName: string, dbName: string) {

    super(`getDb for model '${modelName}' failed because database name '${dbName}'`
      + ` was not defined. Make sure your @Model({dbConfig.db}) is set to a valid database name from your`
      + ` environment config's dbConnections:[{name:'...'}] setting. Also, make sure you've started SakuraApi, or`
      + ` that you have manually started db connections (e.g. with SakuraMongoDbConnection.connectAll())`);
  }
}

/**
 * Thrown when an Id field is required by the database, but is missing.
 */
export class SapiMissingIdErr extends Error {

  /**
   * @param msg The message to be thrown.
   * @param target The target that's throwing the error.
   */
  constructor(msg: string, public target: any) {
    super(`${msg}; target: ${target.name || target.constructor.name}`);
  }

}

/**
 * Thrown when provided a class that isn't decorated with `@`[[Model]].
 */
export class SapiInvalidModelObject extends Error {
  /**
   * @param msg The message to be thrown.
   * @param target The target that's throwing the error.
   */
  constructor(msg: string, target: any) {
    super(`${msg}; target ${(target) ? target.name || target.constructor.name : `${target}`}`);
  }
}

// tslint:enable max-classes-per-file
