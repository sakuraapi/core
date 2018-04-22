import { ObjectID } from 'mongodb';
import { testSapi } from '../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../sakura-api';
import { Db } from './db';
import { Json } from './json';
import {
  Model,
  modelSymbols
} from './model';
import { Private } from './private';
import { SapiModelMixin } from './sapi-model-mixin';

describe('@Json', () => {

  @Model({
    dbConfig: {
      collection: 'users',
      db: 'userDb',
      promiscuous: true
    }
  })
  class Test extends SapiModelMixin() {
    @Json('ap')
    aProperty: string = 'test';

    @Json('anp') @Json('anotherProperty')
    anotherProperty: string;

    aThirdProperty: number = 777;

    aFourthProperty: string;

    aFunction() {
      // lint empty
    }
  }

  let test: Test;

  beforeEach(() => {
    test = new Test();
  });

  it('allows the injected functions to be overridden without breaking the internal dependencies', () => {

    test.toJson = () => {
      throw new Error('toJson broken');
    };

    test.toJsonString = () => {
      throw new Error('toJsonString broken');
    };

    expect(test[modelSymbols.toJson]().ap).toBe('test');
    expect(test[modelSymbols.toJson]().anp).toBeUndefined();
    expect(test[modelSymbols.toJson]().aThirdProperty).toBe(777);
    expect(test[modelSymbols.toJson]().aFunction).toBeUndefined();

    const result = JSON.parse(test[modelSymbols.toJsonString]());

    expect(result.ap).toBe('test');
    expect(result.anp).toBeUndefined();
    expect(result.aThirdProperty).toBe(777);
  });
  
  describe('toJsonString', () => {
    it('function is injected into the prototype of the model by default', () => {
      expect(test.toJsonString())
        .toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJsonString', () => {
      const result = JSON.parse(test.toJsonString());

      expect(result.ap).toBe('test');
      expect(result.anp).toBeUndefined();
      expect(result.aThirdProperty).toBe(777);
    });
  });

  describe('fromJsonToDb', () => {

    class Contact {
      @Db('p')
      @Json()
      phone = '111-111-1111';

      @Db()
      @Json()
      nullTest = null; // leave this here, it tests to make sure that model[key] === null isn't recursed into

      @Db()
      @Json()
      wrong: '123'; // leave this here, it tests to make sure that !jsonSrc results in a continue
    }

    @Model()
    class ChangeSetTest extends SapiModelMixin() {

      @Db('first')
      @Json('fn')
      firstName: string;

      @Json('ln')
      @Db()
      lastName: string = '';

      @Db('cn')
      @Json({field: 'ctac', model: Contact})
      contact = new Contact();

      @Db('cn2')
      contact2 = new Contact();
    }

    it('returns an object literal with json fields mapped to db fields', () => {
      const json = {
        ctac: {
          phone: '000'
        },
        fn: 'George',
        ln: 'Washington'
      };

      const dbObj = ChangeSetTest.fromJsonToDb(json);
      expect(dbObj instanceof ChangeSetTest).toBe(false);
      expect(dbObj.first).toBe(json.fn, 'should have been able to handle a property without any value');
      expect(dbObj.lastName).toBe(json.ln, 'last name should have mapped');
      expect(dbObj.cn).toBeDefined('contact should have been included');
      expect(dbObj.cn.p).toBe('000', 'phone should have mapped');
    });

    it('converts id to _id', () => {
      const json = {
        ctac: {
          phone: '000'
        },
        fn: 'George',
        id: new ObjectID().toString(),
        ln: 'Washington'
      };

      const dbObj = ChangeSetTest.fromJsonToDb(json);
      expect(dbObj._id).toBe(json.id, 'json.id was not converted to _id');
    });

    it('converts id = 0 to _id', () => {
      const json = {
        ctac: {
          phone: '000'
        },
        fn: 'George',
        id: 0,
        ln: 'Washington'
      };

      const dbObj = ChangeSetTest.fromJsonToDb(json);
      expect(dbObj._id).toBe(json.id, 'json.id was not converted to _id');
    });

    it(`handles properties accidentally defined like \`wrong: '123'\` instead of \`wrong = '123'\``, () => {
      const json = {
        fn: 'George'
      };

      expect(() => ChangeSetTest.fromJsonToDb(json)).not.toThrow();
    });

    it('handles falsy properties', () => {
      const json = {
        ctac: {
          phone: 0
        },
        ln: 0
      };

      const result = ChangeSetTest.fromJsonToDb(json);
      expect(result.lastName).toBe(0);
      expect(result.cn.p).toBe(0);
    });

    describe('context', () => {
      it('respects context when converting to Db field names', () => {

        @Model()
        class TestContext extends SapiModelMixin() {

          @Json('first_name')
          @Json('fn', 'context1')
          @Json('fName', 'context2')
          @Db('f')
          firstName: string;

          @Json('last_name')
          @Json('ln', 'context1')
          @Json('lName', 'context2')
          @Db('l')
          lastName: string;
        }

        const testContext = TestContext.fromJsonToDb({first_name: 'John', last_name: 'Adams'});
        const testContext1 = TestContext.fromJsonToDb({fn: 'John1', ln: 'Adams1'}, 'context1');
        const testContext2 = TestContext.fromJsonToDb({fName: 'John2', lName: 'Adams2'}, 'context2');

        expect(testContext.f).toBe('John');
        expect(testContext.l).toBe('Adams');

        expect(testContext1.f).toBe('John1');
        expect(testContext1.l).toBe('Adams1');

        expect(testContext2.f).toBe('John2');
        expect(testContext2.l).toBe('Adams2');

      });
    });
  });

  describe('fromJsonArray', () => {
    it('from is injected into the model as a static member by default', () => {
      expect(Test.fromJsonArray).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', () => {
      @Model()
      class SymbolTest extends SapiModelMixin() {
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

    it('maintains proper instanceOf', () => {
      const obj = Test.fromJsonArray([{}]);

      expect(obj[0] instanceof Test).toBe(true);
    });

    it('gracefully takes a non array', () => {
      const obj1 = Test.fromJsonArray(null);
      const obj2 = Test.fromJsonArray(undefined);

      expect(Array.isArray(obj1)).toBeTruthy();
      expect(Array.isArray(obj2)).toBeTruthy();
    });
  });
});
