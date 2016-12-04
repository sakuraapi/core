import {SakuraApiConfig} from './config';

describe('config', function () {

  beforeEach(function () {
    this.path = 'spec/test_config/environment.json';

    spyOn(console, 'log');
  });

  describe('load(...)', function () {
    it('loads the default config file if config file not found in path', function() {
      this.path = this.path.replace('environment.json', 'not_found.json');
      try {
        let cfg = new SakuraApiConfig().load(this.path);
        expect(cfg.SAKURA_API_CONFIG_TEST).toEqual('found');
      } catch (err) {
        fail(err);
      }
    });

    it('loads the config file and properly cascades', function() {
      try {
        let cfg = new SakuraApiConfig().load(this.path);
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

    describe('throws an error', function() {
      it('when the config file is empty', function() {
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

      it('when the config file is not valid JSON', function() {
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
});
