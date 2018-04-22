import { ObjectID } from 'bson';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { Db } from '../db';
import { Json } from '../json';
import { Model } from '../model';
import { Private } from '../private';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.toJson', () => {

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

  it('function is injected into the prototype of the model by default', () => {
    @Model()
    class User extends SapiModelMixin() {
      firstName = 'George';
      lastName: string;
    }

    expect(new User().toJson).toBeDefined();
  });

  it('transforms a defined property to the designated fieldName in the output of toJson', () => {

    class Address {
      @Db('st')
      street = '1600 Pennsylvania Ave NW';

      @Db('c')
      @Json('cy')
      city = 'Washington';

      state = 'DC';

      @Json('z')
      zipCode = '20500';
    }

    class Contact {
      @Db('ph')
      phone = '123-123-1234';

      @Db({field: 'a', model: Address})
      @Json('addr')
      address = new Address();
    }

    @Model({})
    class User extends SapiModelMixin() {
      @Db('fn')
      @Json('fn')
      firstName = 'George';
      @Db('ln')
      @Json('ln')
      lastName = 'Washington';

      @Db({field: 'c', model: Contact})
      contact = new Contact();
    }

    const db = {
      c: {
        a: {
          st: '1'
        },
        ph: 'abc'
      },
      fn: 'John',
      ln: 'Doe'
    };

    const user = User.fromDb(db);
    const json = (user.toJson() as any);

    expect(json.fn).toBe(db.fn);
    expect(json.ln).toBe(db.ln);
    expect(json.contact).toBeDefined('A property not decorated with @Json should still be marshalled to Json');
    expect(json.contact.phone).toBe(db.c.ph);
    expect(json.contact.addr).toBeDefined('A deeply nested property should be marshalled to Json');
    expect(json.contact.addr.street).toBe(db.c.a.st);
    expect(json.contact.addr.cy).toBe(user.contact.address.city);
    expect(json.contact.addr.state).toBe(user.contact.address.state);
    expect(json.contact.addr.z).toBe(user.contact.address.zipCode);
  });

  it('properties are marshalled when not decorated with @Json properties', () => {

    class Contact {
      static test() {
        // methods should be marshalled to the resulting json object
      }

      phone = 123;
      address = '123 Main St.';

      test() {
        // methods should be marshalled to the resulting json object
      }
    }

    @Model()
    class User extends SapiModelMixin() {
      firstName = 'George';
      lastName: string;
      contact = new Contact();
    }

    const user = new User();
    const json = (user.toJson() as any);

    expect(json.firstName).toBe(user.firstName);
    expect(json.lastname).toBeUndefined('properties without assigned values and no default values do not actually' +
      ' exist in the resulting transpiled js output, so they cannot be marshalled to json');
    expect(json.contact).toBeDefined('A property defining a child object should be included in the resulting json');
    expect(json.contact.phone).toBe(user.contact.phone);
    expect(json.contact.address).toBe(user.contact.address);

    expect(json.contact.test).toBeUndefined('instance methods should not be included in the resulting json');
  });

  it('does not return _id', () => {
    class Contact {
      phone = 123;
      address = '123 Main St.';
    }

    @Model()
    class User extends SapiModelMixin() {
      firstName = 'George';
      lastName: string;
      contact = new Contact();
    }

    const user = new User();
    user.id = new ObjectID();
    const json = user.toJson();

    expect(user._id).toBeDefined('The test user should have a valid _id for this test to be meaningful');
    expect(user.id).toBeDefined('The test user should have a valid id for this test to be meaningful');
    expect(json._id).toBeUndefined('_id should not be included because id maps to the same value');
    expect(json.id).toBe(user.id, 'id should be included and should be the same as the model\'s _id');
    expect(test.toJson()._id).toBeUndefined();
  });

  it('handles falsy properties', () => {
    class Deep {
      @Json()
      value = 0;
    }

    @Model()
    class User extends SapiModelMixin() {
      @Json('fn')
      firstName = 0;

      @Json({model: Deep})
      deep = new Deep();
    }

    const user = new User();

    const result = user.toJson();
    expect(result.fn).toBe(0);
    expect(result.deep.value).toBe(0);
  });

  describe('integrates with fromDb in strict mode', () => {

    class Contact {
      @Db('ph') @Json()
      phone = '321-321-3214';
    }

    @Model({
      dbConfig: {
        collection: 'dbAndJsonIntegrationTest',
        db: 'userDb'
      }
    })
    class User extends SapiModelMixin() {
      @Db('fn') @Json('fName')
      firstName = 'George';
      @Db('ln') @Json('lName')
      lastName = 'Washington';

      @Db({field: 'cn', model: Contact}) @Json('cn')
      contact = new Contact();
    }

    let sapi: SakuraApi;
    beforeEach((done) => {
      sapi = testSapi({
        models: [
          User
        ],
        routables: []
      });

      sapi
        .dbConnections
        .connectAll()
        .then(() => User.removeAll({}))
        .then(() => new User().create())
        .then(done)
        .catch(done.fail);
    });

    afterEach(async (done) => {
      try {
        await sapi.close();
        sapi.deregisterDependencies();
        done();
      } catch (err) {
        done.fail(err);
      }
    });

    it('returns only projected fields', (done) => {
      const project = {
        _id: 0,
        fn: 1
      };

      User
        .get({filter: {}, project})
        .then((results) => {
          const result = results[0].toJson();
          expect(result.fName).toBe('George', 'firstName should have projected to json');
          expect(result.lName).toBeUndefined('lastName should not have projected to json');
          expect(result._id).toBeUndefined('_id should not have projected to json');
          expect(result.id).toBeUndefined('id should not have projected to json');
          expect(result.cn).toBeUndefined('contact embedded document should not have projected to json');
        })
        .then(done)
        .catch(done.fail);
    });

    it('supports projecting into embedded documents', (done) => {
      const project = {
        'cn.ph': 1
      };

      User
        .get({filter: {}, project})
        .then((results) => {
          const result = results[0].toJson();

          expect(result.fName).toBeUndefined('firstName should not have projected to json');
          expect(result.lName).toBeUndefined('lastName should not have projected to json');
          expect(result._id).toBeUndefined('_id should not have projected to json');
          expect(result.id).toBeDefined('id should have projected to json');
          expect(result.cn).toBeDefined('contact embedded document should  have projected to json');
          expect(result.cn.phone).toBeDefined('contact.phone should have projected to json');
        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('when interacting with Db', () => {
    class Contact {
      phone = 123;
      address = '123 Main St.';
    }

    @Model({
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: true
      }
    })
    class User extends SapiModelMixin() {
      firstName = 'George';
      lastName: string;
      contact = new Contact();
    }

    beforeEach((done) => {
      const sapi = testSapi({
        models: [
          User
        ],
        routables: []
      });

      sapi
        .dbConnections
        .connectAll()
        .then(() => User.removeAll({}))
        .then(done)
        .catch(done.fail);
    });

    it('returns id when _id is not null', (done) => {
      const user = new User();

      user
        .create()
        .then(() => User.getById(user._id))
        .then((result) => {
          expect(result._id).toBeDefined();
          expect(result.toJson().id.toString()).toBe(user._id.toString());

        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('obeys @Db:{private:true} by not including that field when marshalling object to json', () => {
    class Address {
      @Db({private: true})
      state = 'DC';

      @Db({private: true})
      @Json('t')
      test = 'test';
    }

    class Contact {
      @Db({field: 'a', model: Address})
      @Json('addr')
      address = new Address();
    }

    @Model()
    class User extends SapiModelMixin() {
      @Db({field: 'fn', private: true})
      firstName = 'George';

      @Db({field: 'ln', private: true})
      @Json('ln')
      lastName = 'Washington';

      @Db({field: 'c', model: Contact})
      contact = new Contact();

      @Db({private: true, model: Contact})
      testObj = new Contact();
    }

    it('when a private @Db field is not decorated with @Json', () => {
      const user = new User();
      const json = user.toJson();

      expect(user.firstName).toBeDefined('This property must be defined for the test to be meaningful');
      expect(json.firstName).toBeUndefined('A property with @Db({private:true}) should not include that property ' +
        'in the result json object');

      expect(user.contact.address.state).toBeDefined('This property must be defined for the test to be meaningful');
      expect(json.contact.addr.state)
        .toBeUndefined('A property with @Db({private:true}) should not include that property ' +
          'in the result json object');

    });

    it('when a private @Db fields is also decordated with @Json', () => {
      const user = new User();
      const json = user.toJson();

      expect(user.lastName).toBeDefined('this test is not meaningful if not defined');
      expect(json.ln).toBeUndefined('this property should not have been marshalled to json because it has ' +
        '@Db({private:true}');
      expect(json.lastName).toBeUndefined('this property should not have been marshalled to json because it has ' +
        '@Db({private:true}');

      expect(user.contact.address.test).toBeDefined('this test is not meaningful is not defined');
      expect(json.contact.addr.t).toBeUndefined('A property decorated with @Db({private:true}) should not be ' +
        'marshalled to json');
      expect(json.contact.addr.test).toBeUndefined('A property decorated with @Db({private:true}) should not be ' +
        'marshalled to json');
    });

    it('@Db({private:true} on an @Json property that\'s an object is respected', () => {
      const user = new User();
      const json = user.toJson();

      expect(user.testObj).toBeDefined('this test is not meaningful is this is not defined');
      expect(json.testObj).toBeUndefined('@Db({private:true}) properties should not be marshalled to json');
    });

  });

  describe('context', () => {
    it('builds a default context when none is provided', () => {

      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('fn')
        firstName = 'George';

        @Json() @Private()
        lastName = 'Washington';
      }

      const testContext = new TestContext();
      const result = testContext.toJson('default');

      expect(result.fn).toBe(testContext.firstName);
      expect(result.lastName).toBeUndefined();

    });

    it('falls back to using property names (no context) when an invalid context is passed in', () => {
      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('fn')
        firstName = 'George';

        @Json() @Private()
        lastName = 'Washington';
      }

      const testContext = new TestContext();
      const result = testContext.toJson('non-existent');

      expect(result.firstName).toBe(testContext.firstName);
      expect(result.lastName).toBe(testContext.lastName);
    });

    it('supports multiple contexts', () => {
      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('fn', 'context1')
        @Json('fName', 'context2')
        firstName = 'George';

        @Private('*')
        lastName = 'Washington';
      }

      const testContext = new TestContext();
      const result1 = testContext.toJson('context1');
      const result2 = testContext.toJson('context2');

      expect(result1.fn).toBe(testContext.firstName);
      expect(result1.lastName).toBeUndefined();

      expect(result2.fName).toBe(testContext.firstName);
      expect(result2.lastName).toBeUndefined();

    });

    it('falls back on default when no context is given', () => {
      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('f')
        @Json('fn', 'context1')
        @Json('fName', 'context2')
        firstName = 'George';

        @Private()
        lastName = 'Washington';
      }

      const testContext = new TestContext();
      const result = testContext.toJson();

      expect(result.f).toBe(testContext.firstName);
      expect(result.lastName).toBeUndefined();
    });

    it('takes context as an option', () => {
      @Model()
      class TestContext extends SapiModelMixin() {

        @Json({field: 'fn', context: 'context1'})
        firstName = 'George';

        @Private('*')
        lastName = 'Washington';
      }

      const testContext = new TestContext();
      const result = testContext.toJson('context1');

      expect(result.fn).toBe(testContext.firstName);
      expect(result.lastName).toBeUndefined();
    });

    describe('* context', () => {
      it('can be set by @Json decorator', () => {

        @Model()
        class TestModel extends SapiModelMixin() {
          @Json('p1', 'context1')
          prop1 = 'val1';

          @Json('p2', '*')
          prop2 = 'val2';

          @Json('p3')
          prop3 = 'val3';
        }

        const resultNoContext = (new TestModel()).toJson();
        expect(resultNoContext.p1).toBeUndefined();
        expect(resultNoContext.p2).toBe('val2');
        expect(resultNoContext.p3).toBe('val3');

        const resultWithContext = (new TestModel()).toJson('context1');
        expect(resultWithContext.p1).toBe('val1');
        expect(resultWithContext.p2).toBe('val2');
        expect(resultWithContext.p3).toBeUndefined();
      });

      describe('formatToJson support', () => {
        let order = '';
        let prop1FormatterCalled = false;
        let prop2FormatterCalled = false;

        @Model()
        class TestModel extends SapiModelMixin() {
          @Json({
            context: 'context1',
            field: 'p1',
            formatToJson: () => prop1FormatterCalled = true
          })
          prop1 = 'val1';

          @Json({
            context: '*',
            field: 'p2',
            formatToJson: () => prop2FormatterCalled = true
          })
          prop2 = 'val2';

          @Json({
            context: 'context1',
            field: 'p3',
            formatToJson: () => order += '1'
          })
          @Json({
            context: '*',
            field: 'p3',
            formatToJson: () => order += '2'
          })
          prop3 = 'val3';
        }

        const data = {p1: 'val1', p2: 'val2', p3: 'val3'};

        afterEach(() => {
          order = '';
          prop1FormatterCalled = false;
          prop2FormatterCalled = false;
        });

        it('calls when no matching context but @Json context * present', () => {
          (new TestModel()).toJson();
          expect(prop1FormatterCalled).toBeFalsy();
          expect(prop2FormatterCalled).toBeTruthy();
        });

        it('calls when matching context', () => {
          (new TestModel()).toJson('context1');
          expect(prop1FormatterCalled).toBeTruthy();
          expect(prop2FormatterCalled).toBeTruthy();
        });

        it('calls more specific context then * context formatter', () => {
          (new TestModel()).toJson('context1');
          expect(order).toBe('12');
          expect(prop1FormatterCalled).toBeTruthy();
          expect(prop2FormatterCalled).toBeTruthy();
        });
      });
    });
  });

  describe('formatToJson', () => {
    it('flat objects', () => {

      let valSet;
      let keySet;

      @Model({})
      class SomeModel extends SapiModelMixin() {

        @Json({
          formatToJson: (val, key) => 'override'
        })
        someProperty = 'default';

        @Json({
          field: 'sp2',
          formatToJson: (val, key) => {
            valSet = val;
            keySet = key;
            return 'override2';
          }
        })
        someProperty2 = 'default';

        @Json()
        someOtherProperty: string;

      }

      const someModel = SomeModel.fromJson({
        someOtherProperty: 'hello'
      });
      const json = someModel.toJson();

      expect(json.someProperty).toBe('override');
      expect(json.sp2).toBe('override2');
      expect(json.someOtherProperty).toBe('hello');
      expect(valSet).toBe('default');
      expect(keySet).toBe('someProperty2');

    });

    it('deep objects', () => {
      @Model()
      class SomeDeepModel extends SapiModelMixin() {
        @Json({
          formatToJson: (val, key) => 'override'
        })
        someProperty = 'default';

        @Json({
          field: 'sp2',
          formatToJson: (val, key) => 'override2'
        })
        someProperty2 = 'default';

        @Json()
        someOtherProperty: string;
      }

      @Model()
      class SomeModel extends SapiModelMixin() {

        @Json({
          formatToJson: (val, key) => 'override'
        })
        someProperty = 'default';

        @Json({
          field: 'sp2',
          formatToJson: (val, key) => 'override2'
        })
        someProperty2 = 'default';

        @Json()
        someOtherProperty: string;

        @Json({model: SomeDeepModel})
        someDeepModel: SomeDeepModel;
      }

      const someModel = SomeModel.fromJson({
        someDeepModel: {},
        someOtherProperty: 'hello'
      });
      const json = someModel.toJson();

      expect(json.someProperty).toBe('override');
      expect(json.sp2).toBe('override2');
      expect(json.someOtherProperty).toBe('hello');

      expect(json.someDeepModel.someProperty).toBe('override');
      expect(json.someDeepModel.sp2).toBe('override2');
    });
  });

  describe('IJsonOptions', () => {

    describe('.model', () => {

      const jsonData = {
        order: [
          {
            adr: {
              c: 'Rancho Palos Verdes',
              code: '1',
              st: '1',
              state: 'CA1'
            },
            on: 123,
            t: 1
          },
          {
            adr: {
              c: 'Palos Verdes Estates',
              code: '2',
              st: '2',
              state: 'CA2'
            },
            on: 321,
            t: 2
          }
        ]
      };

      class Address {
        @Json('st')
        street = '1600 Pennsylvania Ave NW';
        @Json('c')
        city = 'Washington';
        @Json()
        state = 'DC';
        @Json('code')
        gateCode = '123';
        dogsName = 'Charlie';
      }

      class Order {
        @Json('on')
        orderNumber = 'a123';
        @Json('t')
        total = 100;
        @Json({field: 'adr', model: Address})
        address: Address = new Address();
      }

      @Model()
      class ModelMapTest extends SapiModelMixin() {
        @Json({model: Order})
        order: Order[] = [];
      }

      it('array of sub documents - #167', () => {
        const test = ModelMapTest.fromJson(jsonData).toJson();

        expect(test.order.length).toBe(2);
        expect(test.order[0].on).toBe(jsonData.order[0].on);
        expect(test.order[0].t).toBe(jsonData.order[0].t);
        expect(test.order[0].adr.c).toBe(jsonData.order[0].adr.c);
        expect(test.order[0].adr.code).toBe(jsonData.order[0].adr.code);
        expect(test.order[0].adr.st).toBe(jsonData.order[0].adr.st);
        expect(test.order[0].adr.state).toBe(jsonData.order[0].adr.state);

        expect(test.order[1].on).toBe(jsonData.order[1].on);
        expect(test.order[1].t).toBe(jsonData.order[1].t);
        expect(test.order[1].adr.c).toBe(jsonData.order[1].adr.c);
        expect(test.order[1].adr.code).toBe(jsonData.order[1].adr.code);
        expect(test.order[1].adr.st).toBe(jsonData.order[1].adr.st);
        expect(test.order[1].adr.state).toBe(jsonData.order[1].adr.state);
      });

    });
  });
});
