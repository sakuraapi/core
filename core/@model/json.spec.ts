import {ObjectID} from 'mongodb';
import {Db} from './db';
import {Json} from './json';
import {
  Model,
  modelSymbols
} from './model';
import {SakuraApiModel} from './sakura-api-model';

import {sapi} from '../../spec/helpers/sakuraapi';

describe('@Json', function() {

  @Model(sapi, {
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

  @Model(sapi)
  class Test2 {
    aProperty: string = 'test';
    anotherProperty: string;
    aThirdProperty: number = 777;

    aFunction() {
    }
  }

  beforeEach(function() {
    this.t = new Test();
    this.t2 = new Test2();
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
      @Model(sapi)
      class User extends SakuraApiModel {
        firstName = 'George';
        lastName: string;
      }

      expect(new User().toJson).toBeDefined();
    });

    it('transforms a defined property to the designated fieldName in the output of toJson', function() {

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

      @Model(sapi, {})
      class User extends SakuraApiModel {
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

    it('properties are marshalled when not decorated with @Json properties', function() {

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

      @Model(sapi, {})
      class User extends SakuraApiModel {
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

    it('does not return _id', function() {
      class Contact {
        phone = 123;
        address = '123 Main St.';
      }

      @Model(sapi, {})
      class User extends SakuraApiModel {
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
      expect(this.t.toJson()._id).toBeUndefined();
    });

    describe('when interacting with Db', function() {
      class Contact {
        phone = 123;
        address = '123 Main St.';
      }

      @Model(sapi, {
        dbConfig: {
          collection: 'users',
          db: 'userDb',
          promiscuous: true
        }
      })
      class User extends SakuraApiModel {
        firstName = 'George';
        lastName: string;
        contact = new Contact();
      }

      beforeEach(function(done) {
        sapi
          .dbConnections
          .connectAll()
          .then(() => User.removeAll({}))
          .then(done)
          .catch(done.fail);
      });

      it('returns id when _id is not null', function(done) {
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

    describe('obeys @Db:{private:true} by not including that field when marshalling object to json', function() {
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

      @Model(sapi, {})
      class User extends SakuraApiModel {
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

      it('when a private @Db field is not decorated with @Json', function() {
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

      it('when a private @Db fields is also decordated with @Json', function() {
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

      it('@Db({private:true} on an @Json property that\'s an object is respected', function() {
        const user = new User();
        const json = user.toJson();

        expect(user.testObj).toBeDefined('this test is not meaningful is this is not defined');
        expect(json.testObj).toBeUndefined('@Db({private:true}) properties should not be marshalled to json');
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
      @Model(sapi)
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
      @Model(sapi)
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
      @Model(sapi)
      class TestDefaults extends SakuraApiModel {
        firstName: string = 'George';
        lastName: string = 'Washington';
      }

      const data = {
        firstName: 'Thomas',
        lastName: 'Jefferson'
      };

      const test = TestDefaults.fromJson(data);

      expect(test.firstName).toBe(data.firstName);
      expect(test.lastName).toBe(data.lastName);
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
          id: new ObjectID().toString()
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
          _id: new ObjectID().toString()
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

  describe('fromJsonAsChangeSet', function() {

    @Model(sapi)
    class ChangeSetTest extends SakuraApiModel {

      @Json('fn')
      firstName: string = '';
      @Json('ln')
      lastName: string = '';

    }

    it('takes a json object and transforms it to a change set object', function() {
      const body = {
        fn: 'George',
        ln: 'Washington'
      };

      const result = ChangeSetTest.fromJsonAsChangeSet(body);

      expect(result.firstName).toBe(body.fn);
      expect(result.lastName).toBe(body.ln);
      expect(result instanceof ChangeSetTest).toBe(false);
    });
  });

  describe('fromJsonArray', function() {
    it('from is injected into the model as a static member by default', function() {
      expect(Test.fromJsonArray).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', function() {
      @Model(sapi)
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
