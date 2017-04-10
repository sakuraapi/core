/**
 * Thrown when an Id field is required by the database, but is missing.
 */
export class SapiMissingIdErr extends Error {

  /**
   * @param msg The message to be thrown.
   * @param target The target that's throwing the error.
   */
  constructor(msg: string, public target: any) {
    super(msg);
  }

}
