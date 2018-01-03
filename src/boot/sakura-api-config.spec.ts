import * as path from 'path';
import {testMongoDbUrl, testSapi} from '../../spec/helpers/sakuraapi';
import {SakuraMongoDbConnection} from '../core/sakura-mongo-db-connection';
import {SakuraApiConfig} from './sakura-api-config';

describe('sakura-api-config', () => {

  const sapi = testSapi({
    models: [],
    routables: []
  });

  beforeEach(() => {
    this.path = 'lib/spec/test_config/environment.json';
  });

  describe('load(...)', () => {
    it('loads the default config file if config file not found in path', () => {
      this.path = this.path.replace('environment.json', 'not_found.json');

      try {
        const cfg = new SakuraApiConfig().load(this.path);
        expect(cfg.SAKURA_API_CONFIG_TEST).toEqual('found');
      } catch (err) {
        fail(err);
      }
    });

    it('loads the config file and properly cascades', () => {

      try {
        const cfg = new SakuraApiConfig().load(this.path);
        expect(cfg).toBeDefined();
        expect(cfg.baseFile).toBe(true);
        expect(cfg.ts).toBe(true);
        expect(cfg.envFile).toBe(true);
        expect(cfg.envTs).toBe(777);
        expect(cfg.override).toBe(1);
        expect(cfg.SAKURA_API_CONFIG_TEST).toBe('found');
      } catch (err) {
        fail(err);
      }
    });

    describe('SAKURA_API_CONFIG env path ', () => {
      afterEach(() => {
        delete process.env.SAKURA_API_CONFIG;
      });

      it('when defined, loads config from that path', (done) => {
        process.env.SAKURA_API_CONFIG = path.join(process.cwd(), 'spec/test_config/test-SAKURA_API_CONFIG.json');

        try {
          const cfg = new SakuraApiConfig().load();
          expect(cfg['env-SAKURA_API_CONFIG']).toBeTruthy();
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      it('when path is bad, behaves as expected', (done) => {
        process.env.SAKURA_API_CONFIG = path.join(process.cwd(), 'spec/test_config/test-SAKURA_API_CONFIG');

        try {
          const cfg = new SakuraApiConfig().load();
          expect(cfg['env-SAKURA_API_CONFIG']).toBeUndefined();
          done();
        } catch (err) {
          done.fail(err);
        }

      });
    });

    describe('throws an error', () => {
      it('when the config file is empty', () => {
        this.path = this.path.replace('environment.json', 'environment.invalid.json');

        try {
          new SakuraApiConfig().load(this.path);
          fail('should have thrown error');
        } catch (err) {
          expect(err.message).toBe('Unexpected end of JSON input');
          expect(err.code).toBe('INVALID_JSON_EMPTY');
          expect(err.path).toBe(this.path);
        }
      });

      it('when the config file is not valid JSON', () => {
        this.path = this.path.replace('environment.json', 'environment.invalid2.json');

        try {
          new SakuraApiConfig().load(this.path);
          fail('should have thrown error');
        } catch (err) {
          expect(err.message).toContain('Unexpected token');
          expect(err.code).toBe('INVALID_JSON_INVALID');
          expect(err.path).toBe(this.path);
        }
      });
    });
  });

  describe('dataSources(...)', () => {
    beforeEach(() => {

      this.config = new SakuraApiConfig();
      this.dbConnections = {
        dbConnections: [
          {
            name: 'testDb1',
            url: `${testMongoDbUrl(sapi)}/test1`
          },
          {
            name: 'testDb2',
            url: `${testMongoDbUrl(sapi)}/test2`
          }
        ]
      };
    });

    it('returns null if no valid config is found', () => {
      expect(this.config.dataSources()).not.toBeFalsy();
      expect(this.config.dataSources().getConnections().entries.length).toBe(0);
    });

    it('returns a SakuraMongoDbConnection object populated with the dbs in the config, but not yet connected', () => {
      const conns: SakuraMongoDbConnection = this.config.dataSources(this.dbConnections);

      expect(conns.getConnection('testDb1')).toBeDefined();
      expect(conns.getConnection('testDb2')).toBeDefined();
      expect(conns.getDb('testDb1')).toBeUndefined();
      expect(conns.getDb('testDb2')).toBeUndefined();
    });
  });
});
