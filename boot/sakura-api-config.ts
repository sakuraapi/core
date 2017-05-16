import {SakuraMongoDbConnection} from '../core/sakura-mongo-db-connection';
import * as _ from 'lodash';
import * as fs from 'fs';

import debug = require('debug');

/**
 * SakuraApiConfig loads and manages the cascading configuration files of SakuraApi.
 *
 */
export class SakuraApiConfig {

  /**
   * The configuration that was loaded from the various json and ts files and the environmental
   * variables that were set at the time the configuration was last loaded.
   */
  config: any;

  private static debug = {
    normal: debug('sapi:SakuraApiConfig'),
    verbose: debug('sapi:SakuraApiConfig:verbose')
  };
  private debug = SakuraApiConfig.debug;

  /**
   * Instantiate SakuraApiConfig.
   */
  constructor() {
    this.debug.normal('.constructor');
  }

  /**
   * Looks for a `dbConnections` property in the root of config. If one is found, it expects the
   * following:
   * <pre>
   * {
   *     "dbConnections": [
   *         {
   *           "name": "someDb1",
   *           "url": "mongodb://localhost:1234/somedb1",
   *           "mongoClientOptions": {}
   *         },
   *         {
   *           "name": "someDb2",
   *           "url": "mongodb://localhost:1234/somedb2",
   *           "mongoClientOptions": {}
   *         }
   *     ]
   * }
   * </pre>
   * Where `someDb1` is the name of the connection that you can use for retrieving the connection with
   * [[SakuraMongoDbConnection.getDb]]('someDb1').
   */
  dataSources(config: any = this.config): SakuraMongoDbConnection {
    return SakuraApiConfig.dataSources(config);
  }

  /**
   * loads the config file specified by path. If no path is provided, load the path/filename defined in environmental variable SAKURA_API_CONFIG,
   *  otherwise load `config/environment.json` from the root of the project.
   *
   *  SakuraApi looks for a config/ folder in the root of your api project.
   * It cascades the values found in the following order (the last taking precedence over the former):
   *
   * * environment.json
   * * environment.ts
   * * environment.{env}.json
   * * environment.{env}.ts
   * * system environmental variables
   *
   * Where `{env}` is replaced by what's set in the environmental variable `NODE_ENV`. For example, if your set `NODE_ENV=dev` when you start your server, the system will load:
   *
   * * environment.json
   * * environment.ts
   * * environment.dev.json
   * * environment.dev.ts
   * * system environmental variables
   *
   * @param path
   * @returns {{}}
   */
  load(path?: string): any {
    path = path || process.env.SAKURA_API_CONFIG || 'config/environment.json';
    this.debug.normal(`.load path: '${path}'`);

    let config = {};
    let baseConfig = {};
    let baseTsConfig = {};

    // environment.json
    try {
      baseConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
    } catch (err) {
      handleLoadError(err, path, false);
    }

    // environment.ts
    let tsPath = changeFileExtension(path, 'ts');
    try {
      baseTsConfig = require(`${process.cwd()}/${tsPath}`);
    } catch (err) {
      handleLoadError(err, path, true);
    }

    let env = process.env.NODE_ENV;
    let envConfig = {};
    let envTsConfig = {};
    if (env && env.NODE_ENV !== '') {
      // environment.{env}.json
      let pathParts = path.split('/');
      let fileParts = pathParts[pathParts.length - 1].split('.');

      fileParts.splice(fileParts.length - 1, 0, env);
      pathParts[pathParts.length - 1] = fileParts.join('.');
      path = pathParts.join('/');

      try {
        envConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
      } catch (err) {
        handleLoadError(err, path, true);
      }

      path = changeFileExtension(path, 'ts');

      // environment.{env}.ts
      try {
        envTsConfig = require(`${process.cwd()}/${path}`);
      } catch (err) {
        handleLoadError(err, path, true);
      }
    }

    _.merge(config, baseConfig, baseTsConfig, envConfig, envTsConfig, process.env);
    this.config = config;

    this.debug.verbose('.load %O', config);
    return config;

    //////////
    function changeFileExtension(path: string, newExtension: string) {
      let pathParts = path.split('/');
      let fileParts = pathParts[pathParts.length - 1].split('.');
      fileParts[fileParts.length - 1] = newExtension;

      pathParts[pathParts.length - 1] = fileParts.join('.');
      return pathParts.join('/');
    }

    function handleLoadError(err: Error, path: string, noDefault: boolean) {
      if (err['code'] === 'ENOENT') {
        // NOOP: the config file is empty, just default to {}
        SakuraApiConfig.debug.normal(`.load config file empty, defaulting to {} for path: '${path}'`);
        return;
      } else if (err.message.startsWith('Cannot find module')) {
        // NOOP: a ts config file wasn't found
        SakuraApiConfig.debug.normal(`.load config file wasn't found, defaulting to {} for path: '${path}'`);
        return;
      } else if (err.message === 'Unexpected end of JSON input') {
        let e = new Error(err.message);
        e['code'] = 'INVALID_JSON_EMPTY';
        e['path'] = path;
        SakuraApiConfig.debug.normal(`.load path: '${path}', error:`, err);
        throw e;
      } else if (err.message.startsWith('Unexpected token')) {
        let e = new Error(err.message);
        e['code'] = 'INVALID_JSON_INVALID';
        e['path'] = path;
        SakuraApiConfig.debug.normal(`.load path: '${path}', error:`, err);
        throw e;
      } else {
        SakuraApiConfig.debug.normal(`.load path: '${path}', error:`, err);
        throw err;
      }
    }
  }

  /**
   * Same as the instance method, but static, and it won't try to use the last loaded config since that
   * requires an instance.
   */
  static dataSources(config: { dbConnections: any[] }): SakuraMongoDbConnection {
    if (!config || !config.dbConnections) {
      return null;
    }

    if (!Array.isArray(config.dbConnections)) {
      throw new Error('Invalid dbConnections array. The "dbConnections" object should be an array');
    }

    let dbConns = new SakuraMongoDbConnection();

    for (let conn of config.dbConnections) {
      dbConns.addConnection(conn.name, conn.url, conn.mongoClientOptions);
    }

    return dbConns;
  }
}
