import {
  Model,
  modelSymbols
} from './model';
import {Json} from './json';

describe('@Json', function () {

  @Model()
  class Test {
    static fromJson: (...any) => Test;
    static fromJsonArray: (...any) => Test[];

    constructor(public constructedProperty?, public constructedProperty2?) {
    }

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

  it('properties are marshalled when not decorated with @Json properties', function () {
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
      expect(this.t.toJsonString())
        .toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJsonString', function () {
      let result = JSON.parse(this.t.toJsonString());

      expect(result.ap)
        .toBe('test');
      expect(result.anp)
        .toBeUndefined();
      expect(result.aThirdProperty)
        .toBe(777);
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

    it('maintains proper instanceOf', function () {
      let obj = Test.fromJson({});

      expect(obj instanceof Test).toBe(true);
    });

    describe('behaves such that it', function () {

      it('passes on constructor arguments to the @Model target being returned', function () {
        let obj = Test.fromJson({}, 888, 999);

        expect(obj.constructedProperty).toBe(888);
        expect(obj.constructedProperty2).toBe(999);
      });

      it('does not throw if there are no @Json decorators', function () {
        @Model()
        class C {
          static fromJson: (...any) => C;
          someProperty = 777;
        }

        expect(() => C.fromJson({someProperty: 888})).not.toThrow();
        expect(C.fromJson({someProperty: 888}).someProperty).toBe(888);
      });

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

  describe('fromJsonArray', function () {
    it('is injected into the model as a static member by default', function () {
      expect(Test.fromJsonArray)
        .toBeDefined()
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', function () {
      @Model()
      class SymbolTest {
        static fromJsonArray: (...any) => SymbolTest;

        @Json('ap')
        aProperty: number;
      }

      SymbolTest.fromJsonArray = () => {
        throw new Error('fromJsonArray failed');
      };

      let obj = SymbolTest[modelSymbols.fromJsonArray]([{
        ap: 1
      }, {
        ap: 2
      }]);

      expect(obj[0].aProperty)
        .toBe(1);
      expect(obj[1].aProperty)
        .toBe(2);
    });

    it('maintains proper instanceOf', function () {
      let obj = Test.fromJsonArray([{}]);

      expect(obj[0] instanceof Test)
        .toBe(true);
    });

    it('passes on constructor arguments to the @Model target being returned', function () {
      let obj = Test.fromJsonArray([{}], 888, 999);

      expect(obj[0].constructedProperty)
        .toBe(888);
      expect(obj[0].constructedProperty2)
        .toBe(999);
    });

    it('gracefully takes a non array', function () {
      let obj1 = Test.fromJsonArray(null);
      let obj2 = Test.fromJsonArray({});
      let obj3 = Test.fromJsonArray(undefined);
      let obj4 = Test.fromJsonArray();

      expect(Array.isArray(obj1))
        .toBeTruthy();
      expect(Array.isArray(obj2))
        .toBeTruthy();
      expect(Array.isArray(obj3))
        .toBeTruthy();
      expect(Array.isArray(obj4))
        .toBeTruthy();
    });
  });
});
