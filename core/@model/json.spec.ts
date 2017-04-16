import {ObjectID} from 'mongodb';
import {Db} from './db';
import {Json} from './json';
import {
  Model,
  modelSymbols
} from './model';
import {SakuraApiModel} from './sakura-api-model';

describe('@Json', function() {

  @Model({
    dbConfig: {
      collection: 'users',
      db: 'userDb',
      promiscuous: true
    }
  })
  class Test extends SakuraApiModel {
    @Json('ap')
    aProperty: string = 'test';

    @Json('anp') @Json('anotherProperty')
    anotherProperty: string;

    aThirdProperty: number = 777;

    aFourthProperty: string;

    constructor(public constructedProperty?, public constructedProperty2?) {
      super();
    }

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

  @Model()
  class TestDbFieldPrivate {
    aProperty: string = 'test';
    anotherProperty: string;
    aThirdProperty: number = 777;

    @Db({private: true})
    hasDbButNotJson: string = 'test';

    @Json('hasDbAndJson')
    @Db({private: true})
    hasDbAndJson: string = 'test';

    @Json('marshallsWithJsonAndDb')
    @Db()
    marshallsWithJsonAndDb: boolean = true;

    @Json('marshallsWithDb')
    @Db()
    marshallsWithDb: boolean = true;

    aFunction() {
    }
  }

  beforeEach(function() {
    this.t = new Test();
    this.t2 = new Test2();
    this.dbPrivate = new TestDbFieldPrivate();
  });

  it('allows the injected functions to be overridden without breaking the internal dependencies', function() {

    this.t.toJson = function() {
      throw new Error('toJson broken');
    };

    this.t.toJsonString = function() {
      throw new Error('toJsonString broken');
    };

    expect(this.t[modelSymbols.toJson]().ap).toBe('test');
    expect(this.t[modelSymbols.toJson]().anp).toBeUndefined();
    expect(this.t[modelSymbols.toJson]().aThirdProperty).toBe(777);
    expect(this.t[modelSymbols.toJson]().aFunction).toBeUndefined();

    const result = JSON.parse(this.t[modelSymbols.toJsonString]());

    expect(result.ap).toBe('test');
    expect(result.anp).toBeUndefined();
    expect(result.aThirdProperty).toBe(777);
  });

  describe('toJson', function() {
    it('function is injected into the prototype of the model by default', function() {
      expect(this.t.toJson).toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJson', function() {
      expect(this.t.toJson().ap).toBe('test');
      expect(this.t.toJson().anp).toBeUndefined();
      expect(this.t.toJson().aThirdProperty).toBe(777);
      expect(this.t.toJson().aFunction).toBeUndefined();

      expect(this.t.aProperty).toBe('test');
      expect(this.t.anotherProperty).toBeUndefined();
      expect(this.t.aThirdProperty).toBe(777);
    });

    it('properties are marshalled when not decorated with @Json properties', function() {
      expect(this.t2.toJson().aProperty).toBe('test');
      expect(this.t2.toJson().anotherProperty).toBeUndefined();
      expect(this.t2.toJson().aThirdProperty).toBe(777);
      expect(this.t2.toJson().aFunction).toBeUndefined();
    });

    it('does not return _id', function() {
      this.t._id = new ObjectID();

      expect(this.t._id).toBeDefined();
      expect(this.t.toJson()._id).toBeUndefined();
    });

    describe('when interacting with Db', function() {
      beforeEach(function(done) {
        this
          .sapi
          .dbConnections
          .connectAll()
          .then(done)
          .catch(done.fail);
      });

      it('returns id when _id is not null', function(done) {
        this
          .t
          .create()
          .then(() => {

            Test
              .getById(this.t._id)
              .then(result => {
                expect(result._id).toBeDefined();
                expect(result.toJson()['id'].toString()).toBe(this.t._id.toString());
                done();
              })
              .catch(done.fail);
          })
          .catch(done.fail);
      });
    });

    describe('obeys @Db:{private:true} by not including that field when marshalling object to json', function() {
      it('does not change expected toJson behavior', function() {
        expect(this.dbPrivate.toJson().aProperty).toBe('test');
        expect(this.dbPrivate.toJson().anotherProperty).toBeUndefined();
        expect(this.dbPrivate.toJson().aThirdProperty).toBe(777);
        expect(this.dbPrivate.toJson().aFunction).toBeUndefined();
      });

      it('when a private @Db field is not decorated with @Json', function() {
        expect(this.dbPrivate.toJson().hasDbButNotJson).toBeUndefined();
      });

      it('when a private @Db fiels is also decordated with @Json', function() {
        expect(this.dbPrivate.toJson().hasDbAndJson).toBeUndefined();
      });

      it('works as expected when there is an non private @Db decorator and @Json', function() {
        expect(this.dbPrivate.toJson().marshallsWithJsonAndDb).toBeTruthy();
      });

      it('works as expected when there is an non private @Db decorator and no @Json', function() {
        expect(this.dbPrivate.toJson().marshallsWithDb).toBeTruthy();
      });
    });
  });

  describe('toJsonString', function() {
    it('function is injected into the prototype of the model by default', function() {
      expect(this.t.toJsonString())
        .toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJsonString', function() {
      const result = JSON.parse(this.t.toJsonString());

      expect(result.ap).toBe('test');
      expect(result.anp).toBeUndefined();
      expect(result.aThirdProperty).toBe(777);
    });
  });

  describe('fromJson', function() {
    it('from is injected into the model as a static member by default', function() {
      expect(Test.fromJson).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', function() {
      @Model()
      class SymbolTest extends SakuraApiModel {
        @Json('ap')
        aProperty: number;
      }

      SymbolTest.fromJson = () => {
        throw new Error('fromJson failed');
      };

      const obj = SymbolTest[modelSymbols.fromJson]({
        ap: 1
      });
      expect(obj.aProperty).toBe(1);
    });

    it('maintains proper instanceOf', function() {
      const obj = Test.fromJson({});

      expect(obj instanceof Test).toBe(true);
    });

    it('passes on constructor arguments to the @Model target being returned', function() {
      const obj = Test.fromJson({}, 888, 999);

      expect(obj.constructedProperty).toBe(888);
      expect(obj.constructedProperty2).toBe(999);
    });

    it('does not throw if there are no @Json decorators', function() {
      @Model()
      class C extends SakuraApiModel {
        someProperty = 777;
      }

      expect(() => C.fromJson({someProperty: 888})).not.toThrow();
      expect(C.fromJson({someProperty: 888}).someProperty).toBe(888);
    });

    it('maps an @Json fieldname to an @Model property', function() {
      const obj = Test.fromJson({
        ap: 1
      });
      expect(obj.aProperty).toBe(1);
    });

    describe('allows multiple @json decorators', function() {
      it('with only one of the @json properties used', function() {
        let obj = Test.fromJson({
          anp: 2
        });
        expect(obj.anotherProperty).toBe(2);

        obj = Test.fromJson({
          anotherProperty: 2
        });
        expect(obj.anotherProperty).toBe(2);
      });
      it('with the last property defined in the json object winning if there are multiple matching fields for a property', function() {
        const obj = Test.fromJson({
          anotherProperty: 3,
          anp: 2
        });
        expect(obj.anotherProperty).toBe(2);
      });

    });

    it('maps a model property that has no @Json property, but does have a default value', function() {
      const obj = Test.fromJson({
        aThirdProperty: 3
      });

      expect(obj.aThirdProperty).toBe(3);
    });

    it('does not map a model property that has no default value and has no @Json decorator', function() {
      const obj = Test.fromJson({
        aFourthProperty: 4
      });

      expect(obj.aFourthProperty).toBeUndefined();
    });

    it('maps a model property that has no default value, but does have an @Json decorator', function() {
      const obj = Test.fromJson({
        anotherProperty: '2'
      });

      expect(obj.anotherProperty).toBe('2');
    });

    it('returns a real @Model object, not just an object with the right properties', function() {
      expect(Test.fromJson({}) instanceof Test).toBeTruthy();
    });

    it('returns null when no json object is provided', function() {
      expect(Test.fromJson(null)).toBe(null);
      expect(Test.fromJson(undefined)).toBe(null);
    });

    describe('id behavior', function() {
      it('unmarshalls id as an ObjectID when it is a valid ObjectID', function() {
        const data = {
          id: new ObjectID()
        };

        const test = Test.fromJson(data);

        expect(test.id instanceof ObjectID).toBeTruthy();
        expect(test._id instanceof ObjectID).toBeTruthy();
      });

      it('unmarshalls id as a string when it not a vlaid ObjectID', function() {
        const data = {
          id: '1234567890987654321'
        };

        const test = Test.fromJson(data);

        expect(test.id instanceof ObjectID).not.toBeTruthy();
        expect(test._id instanceof ObjectID).not.toBeTruthy();
      });

      it('unmarshalls _id as an ObjectID when it is a valid ObjectID', function() {
        const data = {
          _id: new ObjectID()
        };

        const test = Test.fromJson(data);

        expect(test._id instanceof ObjectID).toBeTruthy();
        expect(test.id instanceof ObjectID).toBeTruthy();
      });

      it('unmarshalls _id as a string when it is not a valid ObjectID', function() {
        const data = {
          _id: '12345678900987654321'
        };

        const test = Test.fromJson(data);

        expect(test._id instanceof ObjectID).not.toBeTruthy();
        expect(test.id instanceof ObjectID).not.toBeTruthy();
      });
    });

  });

  describe('fromJsonArray', function() {
    it('from is injected into the model as a static member by default', function() {
      expect(Test.fromJsonArray).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', function() {
      @Model()
      class SymbolTest extends SakuraApiModel {
        @Json('ap')
        aProperty: number;
      }

      SymbolTest.fromJsonArray = () => {
        throw new Error('fromJsonArray failed');
      };

      const obj = SymbolTest[modelSymbols.fromJsonArray]([{
        ap: 1
      }, {
        ap: 2
      }]);

      expect(obj[0].aProperty).toBe(1);
      expect(obj[1].aProperty).toBe(2);
    });

    it('maintains proper instanceOf', function() {
      const obj = Test.fromJsonArray([{}]);

      expect(obj[0] instanceof Test).toBe(true);
    });

    it('passes on constructor arguments to the @Model target being returned', function() {
      const obj = Test.fromJsonArray([{}], 888, 999);

      expect(obj[0].constructedProperty).toBe(888);
      expect(obj[0].constructedProperty2).toBe(999);
    });

    it('gracefully takes a non array', function() {
      const obj1 = Test.fromJsonArray(null);
      const obj2 = Test.fromJsonArray(undefined);

      expect(Array.isArray(obj1)).toBeTruthy();
      expect(Array.isArray(obj2)).toBeTruthy();
    });
  });
});
