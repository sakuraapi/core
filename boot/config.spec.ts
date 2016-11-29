import {SakuraApiConfig} from './config';

describe('config', () => {
  let path;
  beforeEach(() => {
    path = 'spec/test_config/environment.json';

    spyOn(console, 'log');
  });

  describe('load(...)', () => {
    it('loads the default config file if config file not found in path', () => {
      path = path.replace('environment.json', 'not_found.json');
      try {
        let cfg = new SakuraApiConfig().load(path);
        expect(cfg.SAKURA_API_CONFIG_TEST).toEqual('found');
      } catch (err) {
        fail(err);
      }
    });

    it('loads the config file and properly cascades', () => {
      try {
        let cfg = new SakuraApiConfig().load(path);
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

    describe('throws an error', () => {
      it('when the config file is empty', () => {
        path = path.replace('environment.json', 'environment.invalid.json');

        try {
          new SakuraApiConfig().load(path);
          fail('should have thrown error');
        } catch (err) {
          expect(err.message).toBe('Unexpected end of JSON input');
          expect(err.code).toBe('INVALID_JSON_EMPTY');
          expect(err.path).toBe(path);
        }
      });

      it('when the config file is not valid JSON', () => {
        path = path.replace('environment.json', 'environment.invalid2.json');

        try {
          new SakuraApiConfig().load(path);
          fail('should have thrown error');
        } catch (err) {
          expect(err.message).toContain('Unexpected token');
          expect(err.code).toBe('INVALID_JSON_INVALID');
          expect(err.path).toBe(path);
        }
      });
    });

  });
});
