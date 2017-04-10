import {
  Db,
  MongoClient,
  MongoClientOptions
} from 'mongodb';

import debug = require('debug');

/**
 * SakuraMongoDbConnection is responsible for managing connections to a MongoDB database or cluster.
 */
export class SakuraMongoDbConnection {

  private connections = new Map<string, { uri: string, options?: MongoClientOptions }>();
  private dbs = new Map<string, Db>();

  private static debug = {
    normal: debug('sapi:SakuraMongoDbConnection'),
    verbose: debug('sapi:SakuraMongoDbConnection:verbose')
  };
  private debug = SakuraMongoDbConnection.debug;

  /**
   * Adds the parameters for a connection but doesn't actually connect to the DB. This is used to queue up
   * connection configurations that are later used for opening connections to MongoDB with [[SakuraMongoDbConnection.connectAll]].
   */
  addConnection(dbName: string, uri: string, options?: MongoClientOptions) {
    this.debug.normal(`.addConnection dbName: '${dbName}', uri: '${uri}', options:`, options);
    this.connections.set(dbName, {uri, options});
    this.debug.verbose(`.addConnection connections: '%O'`, this.connections);
  }

  /**
   * Connects to MongoDB with the supplied parameters and returns a Promise containing the newly connected Db
   * created by `MongoClient.connect`.
   */
  connect(dbName: string, uri: string, options?: MongoClientOptions): Promise<Db> {
    this.debug.normal(`.connect dbName: '${dbName}', uri: '${uri}', options:`, options);

    return new Promise((resolve, reject) => {
      let isConnected = this.getDb(dbName) || null;
      if (isConnected) {
        this.debug.normal(`.connect dbName: '${dbName}' already connected`);
        return resolve(isConnected);
      }

      // Because the connection is asychronous, it's possible for multiple calls to connect
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
          this.debug.normal(`.connect dbName: '${dbName}' connected`);

          this.dbs.set(dbName, db); // replace placeholder with the db
          this.debug.verbose('.connect dbs: %O', this.dbs);
          resolve(db);
        })
        .catch((err) => {
          this.debug.normal(`.connect dbName: '${dbName}' error:`, err);

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
      this.debug.normal('.connectAll start');

      let wait = [];

      for (let connection of this.connections) {
        wait.push(this.connect(connection[0], connection[1].uri, connection[1].options));
      }

      Promise
        .all(wait)
        .then((results) => {
          this.debug.normal('.connectAll done');

          resolve(results);
        })
        .catch((err) => {
          this.debug.normal(`.connectAll error:`, err);

          reject(err);
        });
    });
  }

  /**
   * Closes a specific db Connection and removes it from [[SakuraMongoDbConnection]]'s internal Maps.
   */
  close(dbName: string, forceClose?: boolean): Promise<null> {
    let db = this.dbs.get(dbName);

    this.debug.normal(`.close dbName:'${dbName}', forceClose: ${forceClose}, connection found: ${!!db}`);

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
    this.debug.normal('.closeAll called');

    return new Promise((resolve, reject) => {
      let wait = [];

      for (let db of this.dbs) {
        wait.push(db[1].close());
      }

      Promise
        .all(wait)
        .then(() => {
          this.debug.normal('.closeAll done');

          return resolve();
        })
        .catch((err) => {
          this.debug.normal('.closeAll error:', err);

          reject(err);
        });
    });
  }

  /**
   * Gets an MongoDB `Db` object from the private [[SakuraMongoDbConnection]] map tracking connections.
   */
  getDb(dbName: string): Db {
    let result = this.dbs.get(dbName);

    this.debug.normal(`.getDb dbName: '${dbName}', found: ${!!result}`);
    this.debug.verbose(`.getDb dbs: %O`, this.dbs);

    return result;
  }

  /**
   * Gets a connection parameter from the map tracking connections.
   */
  getConnection(dbName: string): { uri: string, options?: MongoClientOptions } {
    let result = this.connections.get(dbName);

    this.debug.normal(`.getConnection dbName:'${dbName}', found: ${!!result}`);

    return result;
  }
}
