import { Db, MongoClient, MongoClientOptions } from 'mongodb';

const debug = {
  normal: require('debug')('sapi:SakuraMongoDbConnection'),
  verbose: require('debug')('sapi:SakuraMongoDbConnection:verbose')
};

/**
 * SakuraMongoDbConnection is responsible for managing connections to a MongoDB database or cluster.
 */
export class SakuraMongoDbConnection {

  private connections = new Map<string, { uri: string, options?: MongoClientOptions }>();
  private clients = new Map<string, MongoClient>();
  private dbs = new Map<string, Db>();

  /**
   * Adds the parameters for a connection but doesn't actually connect to the DB. This is used to queue up
   * connection configurations that are later used for opening connections to MongoDB with
   * [[SakuraMongoDbConnection.connectAll]].
   */
  addConnection(dbName: string, uri: string, options?: MongoClientOptions): void {
    debug.normal(`.addConnection dbName: '${dbName}', uri: '${uri}', options: %O`, options);

    if (typeof dbName !== 'string') {
      throw new Error(`dbName must be type string but instead was ${typeof dbName}`);
    }

    this.connections.set(dbName, {uri, options});
    debug.verbose(`.addConnection connections: '%O'`, this.connections);
  }

  /**
   * Connects to MongoDB with the supplied parameters and returns a Promise containing the newly connected Db
   * created by `MongoClient.connect`.
   */
  async connect(dbName: string, uri: string, options?: MongoClientOptions): Promise<Db> {
    debug.normal(`.connect dbName: '${dbName}', uri: '${uri}', options:`, options);

    options = options || {};
    options.useNewUrlParser = true;

    let db: Db;

    db = this.getDb(dbName) || null;
    if (db) {
      debug.normal(`.connect dbName: '${dbName}' already connected`);
      return db;
    }

    // Because the connection is asychronous, it's possible for multiple calls to connect
    // to happen before the first call resolves and sets the entry in the dbs Map. Thus,
    // a place holder is inserted to prevent other calls to connect from trying to connect
    // with this dbName.
    //
    // See "parallel, possible race condition" unit test.
    this.dbs.set(dbName, {} as any);
    this.connections.set(dbName, {uri, options});

    try {
      const client = await MongoClient.connect(uri, options);
      this.clients.set(dbName, client);

      db = client.db();

      debug.normal(`.connect dbName: '${dbName}' connected`);

      this.dbs.set(dbName, db); // replace placeholder with the db
      debug.verbose('.connect dbs: %O', this.dbs);
      return db;
    } catch (err) {
      debug.normal(`.connect dbName: '${dbName}' error:`, err);

      this.dbs.delete(dbName); // remove placeholder
      return Promise.reject(err);
    }
  }

  /**
   * Iterates through the connection parameters provided via [[SakuraMongoDbConnection.addConnection]] and connects to
   * MongoDb. Returns a Promise containing an array of the connected MongoDB `Db` objects.
   */
  async connectAll(): Promise<Db[]> {
    debug.normal('.connectAll start');

    const wait = [];

    for (const connection of this.connections) {
      wait.push(this.connect(connection[0], connection[1].uri, connection[1].options));
    }

    try {
      const results = Promise.all(wait);
      debug.normal('.connectAll done');
      return results;
    } catch (err) {
      debug.normal(`.connectAll error:`, err);
      return Promise.reject(err);
    }
  }

  /**
   * Closes a specific db Connection and removes it from [[SakuraMongoDbConnection]]'s internal Maps.
   */
  async close(dbName: string, forceClose?: boolean): Promise<void> {
    const db = this.dbs.get(dbName);
    const client = this.clients.get(dbName);

    debug.normal(`.close dbName:'${dbName}', forceClose: ${forceClose}, connection found: ${!!db}`);

    if (db && client) {
      this.connections.delete(dbName);
      this.clients.delete(dbName);
      this.dbs.delete(dbName);
      return client.close(forceClose);
    }

    return;
  }

  /**
   * Closes all connections tracked by this instance of [[SakuraMongoDbConnection]].
   */
  async closeAll(): Promise<null> {
    debug.normal('.closeAll called');

    const wait = [];

    for (const db of this.dbs) {
      wait.push(this.close(db[0]));
    }

    try {
      await Promise.all(wait);
      debug.normal('.closeAll done');
    } catch (err) {
      debug.normal('.closeAll error:', err);
      return Promise.reject(err);
    }
  }

  /**
   * Gets an MongoDB `Db` object from the private [[SakuraMongoDbConnection]] map tracking connections.
   */
  getDb(dbName: string): Db {
    const result = this.dbs.get(dbName);

    debug.normal(`.getDb dbName: '${dbName}', found: ${!!result}`);
    debug.verbose(`.getDb dbs: %O`, this.dbs);

    return result;
  }

  /**
   * Gets a connection parameter from the map tracking connections.
   */
  getConnection(dbName: string): { uri: string, options?: MongoClientOptions } {
    const result = this.connections.get(dbName);

    debug.normal(`.getConnection dbName:'${dbName}', found: ${!!result}`);

    return result;
  }

  /**
   * Returns a reference to the map of connections currently had.
   */
  getConnections(): Map<string, { uri: string, options?: MongoClientOptions }> {
    return this.connections;
  }
}
