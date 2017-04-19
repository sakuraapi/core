import {Json} from './json';
import {Model} from './model';
import {Private} from './private';
import {SakuraApiModel} from './sakura-api-model';

describe('@Private', function() {
  @Model()
  class Test implements SakuraApiModel {

    @Private()
    aPrivateField1: number = 1;

    @Private('overrideFn')
    aPrivateField2: number = 2;

    @Private('denyOverrideFn')
    aPrivateField3: number = 3;

    @Private('allowOverride')
    aPrivateField4: number = 4;

    @Private('denyOverride')
    aPrivateField5: number = 5;

    @Json('apf4') @Private()
    aPrivateField6: number = 6;

    @Private(true)
    aPrivateField7: number = 7;

    @Private(false)
    aPrivateField8: number = 8;

    aPublicField: number = 777;

    @Private()
    private allowOverride = true;

    @Private()
    private denyOverride = false;

    private overrideFn() {
      return this.allowOverride;
    }

    private denyOverrideFn() {
      return this.denyOverride;
    }
  }

  beforeEach(function() {
    this.t = new Test();
  });

  describe('toJson', function() {
    it('excludes a field decorated with @Private()', function() {
      const json = this.t.toJson();
      expect(json.aPrivateField1)
        .toBeUndefined();
    });

    it(`includes a field decorated with @Private('a_function_returning_true')`, function() {
      const json = this.t.toJson();
      expect(json.aPrivateField2)
        .toBe(2);
    });

    it(`excludes a field decorated with @Private('a_function_returning_false')`, function() {
      const json = this.t.toJson();
      expect(json.aPrivateField3)
        .toBeUndefined();
    });

    it(`includes a field decorated with @Private('a_property_that_is_truthy`, function() {
      const json = this.t.toJson();
      expect(json.aPrivateField4)
        .toBe(4);
    });

    it(`excludes a field decorated with @Private('a_property_that_is_falsy`, function() {
      const json = this.t.toJson();
      expect(json.aPrivateField5)
        .toBeUndefined();
    });

    it('excludes a field that is decorated with both @Private and @Json with an alias', function() {
      const json = this.t.toJson();
      expect(json.aPrivateField6)
        .toBeUndefined();
    });

    it('includes a field that is decorated with @Private and has a truth value', function() {
      const json = this.t.toJson();
      expect(json.aPrivateField7)
        .toBeUndefined();
    });

    it('excludes a field that is decorated with @Private and has a falsy value', function() {
      const json = this.t.toJson();
      expect(json.aPrivateField8)
        .toBeUndefined();
    });

    it('does not exclude a field that is not decorated with @Private', function() {
      const json = this.t.toJson();
      expect(json.aPublicField)
        .toBe(777);
    });
  });
});
