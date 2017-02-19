import {
  Db,
  MongoClient,
  MongoClientOptions
} from 'mongodb';

const debug = require('debug')('sapi:SakuraMongoDbConnection');
const debugVerbose = require('debug')('sapi:SakuraMongoDbConnection:verbose');

export class SakuraMongoDbConnection {

  private connections = new Map<string, {uri: string, options?: MongoClientOptions}>();
  private dbs = new Map<string, Db>();

  /**
   * Adds the parameters for a connection but doesn't actually connect to the DB. This is used to queue up
   * connection configurations that are later used for opening connections to MongoDB with [[SakuraMongoDbConnection.connectAll]].
   */
  addConnection(dbName: string, uri: string, options?: MongoClientOptions) {
    debug(`.addConnection dbName: '${dbName}', uri: '${uri}', options:`, options);
    this.connections.set(dbName, {uri, options});
    debugVerbose(`.addConnection connections: '%O'`, this.connections);
  }

  /**
   * Connects to MongoDB with the supplied parameters and returns a Promise containing the newly connected Db
   * created by `MongoClient.connect`.
   */
  connect(dbName: string, uri: string, options?: MongoClientOptions): Promise<Db> {
    debug(`.connect dbName: '${dbName}', uri: '${uri}', options:`, options);

    return new Promise((resolve, reject) => {
      let isConnected = this.getDb(dbName) || null;
      if (isConnected) {
        debug(`.connect dbName: '${dbName}' already connected`);
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
          debug(`.connect dbName: '${dbName}' connected`);

          this.dbs.set(dbName, db); // replace placeholder with the db
          debugVerbose('.connect dbs: %O', this.dbs);
          resolve(db);
        })
        .catch((err) => {
          debug(`.connect dbName: '${dbName}' error:`, err);

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
      debug('.connectAll start');

      let wait = [];

      for (let connection of this.connections) {
        wait.push(this.connect(connection[0], connection[1].uri, connection[1].options));
      }

      Promise
        .all(wait)
        .then((results) => {
          debug('.connectAll done');

          resolve(results);
        })
        .catch((err) => {
          debug(`.connectAll error:`, err);

          reject(err);
        });
    });
  }

  /**
   * Closes a specific db Connection and removes it from [[SakuraMongoDbConnection]]'s internal Maps.
   */
  close(dbName: string, forceClose?: boolean): Promise<null> {
    let db = this.dbs.get(dbName);

    debug(`.close dbName:'${dbName}', forceClose: ${forceClose}, connection found: ${!!db}`);

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
    debug('.closeAll called');

    return new Promise((resolve, reject) => {
      let wait = [];

      for (let db of this.dbs) {
        wait.push(db[1].close());
      }

      Promise
        .all(wait)
        .then(() => {
          debug('.closeAll done');

          return resolve();
        })
        .catch((err) => {
          debug('.closeAll error:', err);

          reject(err);
        });
    });
  }

  /**
   * Gets an MongoDB `Db` object from the private [[SakuraMongoDbConnection]] map tracking connections.
   */
  getDb(dbName: string): Db {
    let result = this.dbs.get(dbName);

    debug(`.getDb dbName: '${dbName}', found: ${!!result}`);
    debugVerbose(`.getDb dbs: %O`, this.dbs);

    return result;
  }

  /**
   * Gets a connection parameter stored in the private [[SakuraMonoDb]] map tracking connections.
   */
  getConnection(dbName: string): {uri: string, options?: MongoClientOptions} {
    let result = this.connections.get(dbName);

    debug(`.getConnection dbName:'${dbName}', found: ${!!result}`);

    return result;
  }
}
