import {
  Json,
  IModel,
  Model,
  modelSymbols
}               from './model';

describe('core/Model', function () {

  @Model()
  class Test implements IModel {
    testProperty = true;

    static get: (any) => (any) = null;

    static getById() {
      return 'custom';
    }

    constructor(public n: number) {
    }

    save() {
      return 'custom';
    }
  }

  describe('construction', function () {

    beforeEach(function () {
      this.t = new Test(777);
    });

    it('properly passes the constructor parameters', function () {
      expect(this.t.n).toBe(777);
    });

    it('maintains the prototype chain', function () {
      expect(this.t instanceof Test).toBe(true);
    });

    it(`decorates itself with Symbol('sakuraApiModel') = true`, function () {
      expect(this.t[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
    });

    describe('injects default CRUD method', function () {
      @Model()
      class TestDefaultMethods implements IModel {
        static delete: (any) => (any) = null;
        static get: (any) => (any) = null;
        static getById: (any) => (any) = null;
      }

      beforeEach(function () {
        this.tdm = new TestDefaultMethods();
      });

      describe('when none provided by integrator', function () {
        it('static getById', function () {
          expect(TestDefaultMethods.delete('echo')).toBe('echo');
        });

        it('static get', function () {
          expect(TestDefaultMethods.get('echo')).toBe('echo');
        });

        it('static getById', function () {
          expect(TestDefaultMethods.getById('echo')).toBe('echo');
        });

        it('create', function () {
          expect(this.tdm.create('echo')).toBe('echo');
        });

        it('save', function () {
          expect(this.tdm.save('echo')).toBe('echo');
        });

        it('delete', function () {
          expect(this.tdm.save('echo')).toBe('echo');
        });
      });

      describe('but does not overwrite custom methods', function () {
        it('static methods', function () {
          expect(Test.getById()).toBe('custom');
        });

        it('static methods', function () {
          expect(this.t.save()).toBe('custom');
        });
      });

      describe('unless excluded by suppressInjection: [] in ModelOptions', function () {
        @Model({suppressInjection: ['get', 'save']})
        class TestSuppressedDefaultMethods implements IModel {
        }

        beforeEach(function () {
          this.suppressed = new TestSuppressedDefaultMethods();
        });

        it('with static defaults', function () {
          expect(this.suppressed.get).toBe(undefined);
        });

        it('with instance defaults', function () {
          expect(this.suppressed.save).toBe(undefined);
        });
      })
    });
  });

});

describe('core/Model json functionality ', function () {
  @Model()
  class Test {
    static fromJson: (any) => Test;

    @Json('ap')
    aProperty: string = 'test';

    @Json('anp') @Json('anotherProperty')
    anotherProperty: string;

    aThirdProperty: number = 777;

    aFourthProperty: string;

    aFunction() {

    }
  }

  @Model()
  class Test2 {
    aProperty: string = 'test';
    anotherProperty: string;
    aThirdProperty: number = 777;

    aFunction() {
    }
  }

  beforeEach(function () {
    this.t = new Test();
    this.t2 = new Test2();
  });

  it('allows the injected functions to be overridden without breaking the internal dependencies', function () {

    this.t.toJson = function () {
      throw new Error('toJson broken');
    };

    this.t.toJsonString = function () {
      throw new Error('toJsonString broken');
    };

    expect(this.t[modelSymbols.toJson]().ap).toBe('test');
    expect(this.t[modelSymbols.toJson]().anp).toBeUndefined();
    expect(this.t[modelSymbols.toJson]().aThirdProperty).toBe(777);
    expect(this.t[modelSymbols.toJson]().aFunction).toBeUndefined();

    let result = JSON.parse(this.t[modelSymbols.toJsonString]());

    expect(result.ap).toBe('test');
    expect(result.anp).toBeUndefined();
    expect(result.aThirdProperty).toBe(777);
  });

  it('works like a normal object when not decorated with @Json properties', function () {
    expect(this.t2.toJson().aProperty).toBe('test');
    expect(this.t2.toJson().anotherProperty).toBeUndefined();
    expect(this.t2.toJson().aThirdProperty).toBe(777);
    expect(this.t2.toJson().aFunction).toBeUndefined();
  });

  describe('toJson', function () {
    it('is injected into the prototype of the model by default', function () {
      expect(this.t.toJson).toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJson', function () {
      expect(this.t.toJson().ap).toBe('test');
      expect(this.t.toJson().anp).toBeUndefined();
      expect(this.t.toJson().aThirdProperty).toBe(777);
      expect(this.t.toJson().aFunction).toBeUndefined();

      expect(this.t.aProperty).toBe('test');
      expect(this.t.anotherProperty).toBeUndefined();
      expect(this.t.aThirdProperty).toBe(777);
    });
  });

  describe('toJsonString', function () {
    it('is injected into the prototype of the model by default', function () {
      expect(this.t.toJsonString()).toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJsonString', function () {
      let result = JSON.parse(this.t.toJsonString());

      expect(result.ap).toBe('test');
      expect(result.anp).toBeUndefined();
      expect(result.aThirdProperty).toBe(777);
    });
  });

  describe('fromJson', function () {
    it('is injected into the model as a static member by default', function () {
      expect(Test.fromJson).toBeDefined()
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', function () {
      @Model()
      class SymbolTest {
        static fromJson: (any) => SymbolTest;

        @Json('ap')
        aProperty: number;
      }

      SymbolTest.fromJson = () => {
        throw new Error('fromJson failed');
      };

      let obj = SymbolTest[modelSymbols.fromJson]({
        ap: 1
      });
      expect(obj.aProperty).toBe(1);
    });

    describe('behaves such that it', function () {

      it('maps an @Json fieldname to an @Model property', function () {
        let obj = Test.fromJson({
          ap: 1
        });
        expect(obj.aProperty).toBe(1);
      });

      describe('allows multiple @json decorators', function () {
        it('with only one of the @json properties used', function () {
          let obj = Test.fromJson({
            anp: 2
          });
          expect(obj.anotherProperty).toBe(2);

          obj = Test.fromJson({
            anotherProperty: 2
          });
          expect(obj.anotherProperty).toBe(2);
        });
        it('with the last property defined in the json object winning if there are multiple matching fields for a property', function () {
          let obj = Test.fromJson({
            anotherProperty: 3,
            anp: 2
          });
          expect(obj.anotherProperty).toBe(2);
        });

      });

      it('maps a model property that has no @Json property, but does have a default value', function () {
        let obj = Test.fromJson({
          aThirdProperty: 3
        });

        expect(obj.aThirdProperty).toBe(3);
      });

      it('does not map a model property that has no default value and has no @Json decorator', function () {
        let obj = Test.fromJson({
          aFourthProperty: 4
        });

        expect(obj.aFourthProperty).toBeUndefined();
      });

      it('maps a model property that has no default value, but does have an @Json decorator', function () {
        let obj = Test.fromJson({
          anotherProperty: '2'
        });

        expect(obj.anotherProperty).toBe('2');
      });

      it('returns a real @Model object, not just an object with the right properties', function () {
        expect(Test.fromJson({}).aFunction).toBeDefined();
      });

      it('returns null when no json object is provided', function () {
        expect((<any>Test.fromJson)()).toBe(null);
        expect(Test.fromJson(null)).toBe(null);
        expect(Test.fromJson(undefined)).toBe(null);
      });
    });
  });
});



