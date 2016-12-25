import {
  Db,
  MongoClient,
  MongoClientOptions
}                  from 'mongodb';

export class SakuraMongoDbConnection {

  private connections = new Map<string, {uri: string, options?: MongoClientOptions}>();
  private dbs = new Map<string, Db>();

  /**
   * Adds the parameters for a connection but doesn't actually connect to the DB. This is used to queue up
   * connection configurations that are later used for opening connections to MongoDB with [[SakuraMongoDbConnection.connectAll]].
   */
  addConnection(dbName: string, uri: string, options?: MongoClientOptions) {

    this.connections.set(dbName, {uri, options});
  }

  /**
   * Connects to MongoDB with the supplied parameters and returns a Promise containing the newly connected Db
   * created by `MongoClient.connect`.
   */
  connect(dbName: string, uri: string, options?: MongoClientOptions): Promise<Db> {
    return new Promise((resolve, reject) => {
      let isConnected = this.getDb(dbName) || null;
      if (isConnected) {
        return resolve(isConnected);
      }

      // Because the connection is asychronous, it's possible for multiple calles to connect
      // to happen before the first call resolves and sets the entry in the dbs Map. Thus,
      // a place holder is inserted to prevent other calls to connect from trying to connect
      // with this dbName.
      //
      // See "parallel, possible race condition" unit test.
      this.dbs.set(dbName, <any>{});
      this.connections.set(dbName, {uri, options});
      MongoClient
        .connect(uri, options)
        .then((db) => {
          this.dbs.set(dbName, db); // replace placeholder with the db
          resolve(db);
        })
        .catch((err) => {
          this.dbs.delete(dbName); // remove placeholder
          reject(err);
        });
    });
  }

  /**
   * Iterates through the connection parameters provided via [[SakuraMongoDbConnection.addConnection]] and connects to
   * MongoDb. Returns a Promise containing an array of the connected MongoDB `Db` objects.
   */
  connectAll(): Promise<Db[]> {
    return new Promise((resolve, reject) => {
      let wait = [];

      for (let connection of this.connections) {
        wait.push(this.connect(connection[0], connection[1].uri, connection[1].options));
      }

      Promise
        .all(wait)
        .then((results) => {
          resolve(results);
        })
        .catch(reject);
    });
  }

  /**
   * Closes a specific db Connection and removes it from [[SakuraMongoDbConnection]]'s internal Maps.
   */
  close(dbName: string, forceClose?: boolean): Promise<null> {
    let db = this.dbs.get(dbName);

    if (db) {
      this.connections.delete(dbName);
      this.dbs.delete(dbName);
      return db.close(forceClose)
    }

    return Promise.resolve(null);
  }

  /**
   * Closes all connections tracked by this instance of [[SakuraMongoDbConnection]].
   */
  closeAll(): Promise<null> {
    return new Promise((resolve, reject) => {
      let wait = [];

      for (let db of this.dbs) {
        wait.push(db[1].close());
      }

      Promise
        .all(wait)
        .then(() => {
          return resolve();
        })
        .catch(reject)
    });
  }

  /**
   * Gets an MongoDB `Db` object from the private [[SakuraMongoDbConnection]] map tracking connections.
   */
  getDb(dbName: string): Db {
    return this.dbs.get(dbName);
  }

  /**
   * Gets a connection parameter stored in the private [[SakuraMonoDb]] map tracking connections.
   */
  getConnection(dbName: string): {uri: string, options?: MongoClientOptions} {
    return this.connections.get(dbName);
  }
}
