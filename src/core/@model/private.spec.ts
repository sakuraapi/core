import {testSapi} from '../../../spec/helpers/sakuraapi';
import {Json, Model, Private} from './';
import {SapiModelMixin} from './sapi-model-mixin';

describe('@Private', () => {
  const sapi = testSapi({
    models: [],
    routables: []
  });

  @Model()
  class Test extends SapiModelMixin() {

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

  beforeEach(() => {
    this.t = new Test();
  });

  describe('toJson', () => {
    it('excludes a field decorated with @Private()', () => {
      const json = this.t.toJson();
      expect(json.aPrivateField1)
        .toBeUndefined();
    });

    it(`includes a field decorated with @Private('a_function_returning_true')`, () => {
      const json = this.t.toJson();
      expect(json.aPrivateField2)
        .toBe(2);
    });

    it(`excludes a field decorated with @Private('a_function_returning_false')`, () => {
      const json = this.t.toJson();
      expect(json.aPrivateField3)
        .toBeUndefined();
    });

    it(`includes a field decorated with @Private('a_property_that_is_truthy`, () => {
      const json = this.t.toJson();
      expect(json.aPrivateField4)
        .toBe(4);
    });

    it(`excludes a field decorated with @Private('a_property_that_is_falsy`, () => {
      const json = this.t.toJson();
      expect(json.aPrivateField5)
        .toBeUndefined();
    });

    it('excludes a field that is decorated with both @Private and @Json with an alias', () => {
      const json = this.t.toJson();
      expect(json.aPrivateField6)
        .toBeUndefined();
    });

    it('includes a field that is decorated with @Private and has a truth value', () => {
      const json = this.t.toJson();
      expect(json.aPrivateField7)
        .toBeUndefined();
    });

    it('excludes a field that is decorated with @Private and has a falsy value', () => {
      const json = this.t.toJson();
      expect(json.aPrivateField8)
        .toBeUndefined();
    });

    it('does not exclude a field that is not decorated with @Private', () => {
      const json = this.t.toJson();
      expect(json.aPublicField)
        .toBe(777);
    });
  });
});
