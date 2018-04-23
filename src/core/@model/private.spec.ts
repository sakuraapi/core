import { Model } from './';
import { Json } from './json';
import { Private } from './private';
import { SapiModelMixin } from './sapi-model-mixin';

describe('@Private', () => {

  describe('toJson', () => {

    it('simple scenario', () => {
      @Model()
      class Test extends SapiModelMixin() {
        firstName = 'John';
        @Private()
        lastName = 'Adams';
      }

      const result = (new Test()).toJson();

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBeUndefined();
    });

    it('scenario with @Json()', () => {
      @Model()
      class Test extends SapiModelMixin() {

        firstName = 'John';
        @Private() @Json('ln')
        lastName = 'Adams';
        @Private() @Json()
        middleName = 'Quincy';

      }

      const result = (new Test()).toJson();

      expect(result.firstName).toBe('John');
      expect(result.ln).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.middleName).toBeUndefined();
    });

    it('scenario with context', () => {
      @Model()
      class Test extends SapiModelMixin() {

        firstName = 'John';

        @Private() @Json('ln')
        lastName = 'Adams';

        @Private('source2') @Private()
        middleName = 'Quincy';

      }

      const result1 = (new Test()).toJson();
      const result2 = (new Test()).toJson('source2');

      expect(result1.firstName).toBe('John');
      expect(result2.firstName).toBe('John');

      expect(result1.lastName).toBeUndefined();
      expect(result1.ln).toBeUndefined();

      expect(result2.lastName).toBe('Adams');
      expect(result2.ln).toBeUndefined();

      expect(result1.middleName).toBeUndefined();
      expect(result2.middleName).toBeUndefined();
    });

    it('json can be marshalled to a private field', () => {
      @Model()
      class Test extends SapiModelMixin() {
        @Private() @Json('ln')
        lastName = '';
      }

      const result1 = Test.fromJson({ln: 'Adams'});
      const result2 = result1.toJson();

      expect(result1.lastName).toBe('Adams');
      expect(result2.ln).toBeUndefined();
      expect(result2.lastName).toBeUndefined();
    });

    it('supports * context for applying private to everything', () => {
      @Model()
      class Test extends SapiModelMixin() {
        @Private('*') @Json() @Json({context: 'source2'})
        firstName = 'John';

        @Private('*') @Json() @Json({context: 'source2'})
        lastName = 'Adams';

        @Json() @Json({context: 'source2'})
        middleName = 'Quincy';
      }

      const result1 = (new Test()).toJson();
      const result2 = (new Test()).toJson('source2');

      expect(result1.firstName).toBeUndefined();
      expect(result1.lastName).toBeUndefined();
      expect(result1.middleName).toBe('Quincy');

      expect(result2.firstName).toBeUndefined();
      expect(result2.lastName).toBeUndefined();
      expect(result2.middleName).toBe('Quincy');
    });
  });
});
