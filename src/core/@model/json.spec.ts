import {ObjectID} from 'mongodb';
import {testSapi} from '../../../spec/helpers/sakuraapi';
import {Db} from './db';
import {Json} from './json';
import {Model, modelSymbols} from './model';
import {SakuraApiModel} from './sakura-api-model';

describe('@Json', () => {

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

  describe('toJson', () => {
    it('function is injected into the prototype of the model by default', () => {
      @Model()
      class User extends SakuraApiModel {
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

    it('does not return _id', () => {
      class Contact {
        phone = 123;
        address = '123 Main St.';
      }

      @Model()
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
      expect(test.toJson()._id).toBeUndefined();
    });

    it('handles falsy properties', () => {
      class Deep {
        @Json()
        value = 0;
      }

      @Model()
      class User extends SakuraApiModel {
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
      class User extends SakuraApiModel {
        @Db('fn') @Json('fName')
        firstName = 'George';
        @Db('ln') @Json('lName')
        lastName = 'Washington';

        @Db({field: 'cn', model: Contact}) @Json('cn')
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
          .then(() => new User().create())
          .then(done)
          .catch(done.fail);
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
      class User extends SakuraApiModel {
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

  describe('fromJson', () => {

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
    class User extends SakuraApiModel {
      @Db('fn')
      @Json('fn')
      firstName = 'George';
      @Db('ln')
      @Json('ln')
      lastName = 'Washington';

      @Db({field: 'c', model: Contact})
      contact = new Contact();

      @Json({field: 'c2', model: Contact})
      contact2 = new Contact();
    }

    it('fromJson is injected into the model as a static member by default', () => {
      expect(User.fromJson).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', () => {
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

    it('maintains proper instanceOf', () => {
      const obj = User.fromJson({});

      expect(obj instanceof User).toBe(true);
    });

    it('does not throw if there are no @Json decorators', () => {
      @Model()
      class C extends SakuraApiModel {
        someProperty = 777;
      }

      expect(() => C.fromJson({someProperty: 888})).not.toThrow();
      expect(C.fromJson({someProperty: 888}).someProperty).toBe(888);
    });

    it('maps an @Json field name to an @Model property', () => {
      const json = {
        c2: {
          addr: {
            cy: 'test2',
            foreignField: true,
            street: 'test'
          },
          foreignField: true,
          phone: 'aaa'
        },
        contact: {
          addr: {
            cy: 'Los Angeles',
            foreignField: true
          },
          foreignField: true,
          phone: 'a'
        },
        fn: 'Arturo',
        foreignField: true,
        ln: 'Fuente'
      };

      const user = User.fromJson(json);

      // user object
      expect(user.firstName).toBe(json.fn);
      expect(user.lastName).toBe(json.ln);
      expect((user as any).foreignField).toBeUndefined('A foreign field should not map to the ' +
        'resulting model');

      // user.contact object
      expect(user.contact).toBeDefined('user.contact should be defined');
      expect(user.contact instanceof Contact).toBeTruthy(`user.contact should have been instance of Contact but was ` +
        `instance of '${user.contact.constructor.name}' instead`);
      expect(user.contact.phone).toBe(json.contact.phone);
      expect((user.contact as any).foreignField).toBeUndefined('A foreign field should not map to the ' +
        'resulting model');

      // user.contact.address object
      expect(user.contact.address).toBeDefined('user.contact.address should have been defined');
      expect(user.contact.address instanceof Address).toBeTruthy('user.contact.address should be and instance of' +
        ` Address, but was an instance of '${user.contact.address.constructor.name}' instead`);
      expect(user.contact.address.street).toBe('1600 Pennsylvania Ave NW');
      expect(user.contact.address.city).toBe(json.contact.addr.cy);
      expect((user.contact as any).addr).toBeUndefined('addr from the json object should not have made it to the ' +
        ' resulting user object');
      expect((user.contact.address as any).foreignField).toBeUndefined('A foreign field should not map to the ' +
        'resulting model');

      // user.contact2 object
      expect(user.contact2).toBeDefined('contact2 should be a property on the resulting user object');
      expect(user.contact2 instanceof Contact).toBeTruthy(`user.contact should have been instance of Contact but was ` +
        `instance of '${user.contact2.constructor.name}' instead`);
      expect(user.contact2.phone).toBe(json.c2.phone);
      expect((user.contact2 as any).foreignField).toBeUndefined('A foreign field should not map to the ' +
        'resulting model');

      // user.contact2.address object
      expect(user.contact2.address).toBeDefined('user.contact2.address should have been defined');
      expect(user.contact2.address instanceof Address).toBeTruthy('user.contact2.address should be and instance of' +
        ` Address, but was an instance of '${user.contact2.address.constructor.name}' instead`);
      expect((user.contact2.address as any).foreignField).toBeUndefined('A foreign field should not map to the ' +
        'resulting model');
      expect(user.contact2.address.street).toBe(json.c2.addr.street);
      expect(user.contact2.address.city).toBe(json.c2.addr.cy);

    });

    describe('allows multiple @json decorators', () => {
      it('with only one of the @json properties used', () => {
        let obj = Test.fromJson({
          anp: 2
        });
        expect(obj.anotherProperty).toBe(2);

        obj = Test.fromJson({
          anotherProperty: 2
        });
        expect(obj.anotherProperty).toBe(2);
      });
      it('with the last property defined in the json object winning if there are multiple' +
        ' matching fields for a property', () => {
        const obj = Test.fromJson({
          anotherProperty: 3,
          anp: 2
        });
        expect(obj.anotherProperty).toBe(2);
      });

    });

    it('maps a model property that has no @Json property, but does have a default value', () => {
      @Model()
      class TestDefaults extends SakuraApiModel {
        firstName: string = 'George';
        lastName: string = 'Washington';
      }

      const data = {
        firstName: 'Thomas',
        lastName: 'Jefferson'
      };

      const result = TestDefaults.fromJson(data);

      expect(result.firstName).toBe(data.firstName);
      expect(result.lastName).toBe(data.lastName);
    });

    it('does not map a model property that has no default value and has no @Json decorator', () => {
      const obj = Test.fromJson({
        aFourthProperty: 4
      });

      expect(obj.aFourthProperty).toBeUndefined();
    });

    it('maps a model property that has no default value, but does have an @Json decorator', () => {
      const obj = Test.fromJson({
        anotherProperty: '2'
      });

      expect(obj.anotherProperty).toBe('2');
    });

    it('returns a real @Model object, not just an object with the right properties', () => {
      expect(Test.fromJson({}) instanceof Test).toBeTruthy();
    });

    it('returns null when no json object is provided', () => {
      expect(Test.fromJson(null)).toBe(null);
      expect(Test.fromJson(undefined)).toBe(null);
    });

    it('handles falsy properties', () => {
      const json = {
        contact: {
          phone: 0
        },
        ln: 0
      };

      const result = User.fromJson(json);

      expect(result.lastName).toBe(0);
      expect(result.contact.phone).toBe(0);
    });

    it('model decorated properties can be null or undefined - issue #95', () => {

      @Model()
      class ChildChild {
        @Json()
        test = 'default';
      }

      @Model()
      class Child {
        @Json()
        test = 'default';

        @Json({model: ChildChild})
        instantiatedChildChild = new ChildChild();

        @Json({model: ChildChild})
        nullChildChild: ChildChild = null;

        @Json({model: ChildChild})
        undefinedChildChild: ChildChild = undefined;

        @Json({model: ChildChild})
        childChild: ChildChild;
      }

      @Model()
      class Parent extends SakuraApiModel {

        @Json({model: Child})
        instantiatedChild = new Child();

        @Json({model: Child})
        nullChild = null;

        @Json({model: Child})
        undefinedChild = undefined;

        @Json({model: Child})
        child: Child;
      }

      testSapi({
        models: [
          Child,
          Parent
        ]
      });

      let result = Parent.fromJson({
        child: {test: 'pass'},
        instantiatedChild: {test: 'pass'},
        nullChild: {test: 'pass'},
        undefinedChild: {test: 'pass'}
      });

      expect(result.instantiatedChild.test).toBe('pass');
      expect(result.nullChild.test).toBe('pass');
      expect(result.undefinedChild.test).toBe('pass');
      expect(result.child.test).toBe('pass');

      result = Parent.fromJson({
        child: {
          childChild: {test: 'pass'},
          instantiatedChildChild: {test: 'pass'},
          nullChildChild: {test: 'pass'},
          test: 'pass',
          undefinedChildChild: {test: 'pass'}
        },
        instantiatedChild: {
          childChild: {test: 'pass'},
          instantiatedChildChild: {test: 'pass'},
          nullChildChild: {test: 'pass'},
          test: 'pass',
          undefinedChildChild: {test: 'pass'}
        },
        nullChild: {
          childChild: {test: 'pass'},
          instantiatedChildChild: {test: 'pass'},
          nullChildChild: {test: 'pass'},
          test: 'pass',
          undefinedChildChild: {test: 'pass'}
        },
        undefinedChild: {
          childChild: {test: 'pass'},
          instantiatedChildChild: {test: 'pass'},
          nullChildChild: {test: 'pass'},
          test: 'pass',
          undefinedChildChild: {test: 'pass'}
        }
      });

      expect(result.instantiatedChild.instantiatedChildChild.test).toBe('pass');
      expect(result.instantiatedChild.nullChildChild.test).toBe('pass');
      expect(result.instantiatedChild.undefinedChildChild.test).toBe('pass');
      expect(result.instantiatedChild.childChild.test).toBe('pass');

      expect(result.nullChild.instantiatedChildChild.test).toBe('pass');
      expect(result.nullChild.nullChildChild.test).toBe('pass');
      expect(result.nullChild.undefinedChildChild.test).toBe('pass');
      expect(result.nullChild.childChild.test).toBe('pass');

      expect(result.undefinedChild.instantiatedChildChild.test).toBe('pass');
      expect(result.undefinedChild.nullChildChild.test).toBe('pass');
      expect(result.undefinedChild.undefinedChildChild.test).toBe('pass');
      expect(result.undefinedChild.childChild.test).toBe('pass');

      expect(result.child.childChild.test).toBe('pass');
      expect(result.child.nullChildChild.test).toBe('pass');
      expect(result.child.undefinedChildChild.test).toBe('pass');
      expect(result.child.childChild.test).toBe('pass');
    });

    describe('id behavior', () => {

      @Model()
      class User extends SakuraApiModel {
      }

      it('unmarshalls id as an ObjectID when it is a valid ObjectID', () => {
        const data = {
          id: new ObjectID().toString()
        };

        const user = User.fromJson(data);

        expect(new User().id).toBeDefined('nope');
        expect(user instanceof User).toBeTruthy('Should have gotten back an instance of User');
        expect(user.id instanceof ObjectID).toBeTruthy();
        expect(user._id instanceof ObjectID).toBeTruthy();
      });

      it('unmarshalls id as a string when it not a vlaid ObjectID', () => {
        const data = {
          id: '1234567890987654321'
        };

        const results = Test.fromJson(data);

        expect(results.id instanceof ObjectID).not.toBeTruthy();
        expect(results._id instanceof ObjectID).not.toBeTruthy();
      });

      it('unmarshalls _id as an ObjectID when it is a valid ObjectID', () => {
        const data = {
          _id: new ObjectID().toString()
        };

        const results = Test.fromJson(data);

        expect(results._id instanceof ObjectID).toBeTruthy();
        expect(results.id instanceof ObjectID).toBeTruthy();
      });

      it('unmarshalls _id as a string when it is not a valid ObjectID', () => {
        const data = {
          _id: '12345678900987654321'
        };

        const results = Test.fromJson(data);

        expect(results._id instanceof ObjectID).not.toBeTruthy();
        expect(results.id instanceof ObjectID).not.toBeTruthy();
      });
    });

    describe('promiscuous fields, issue #99', () => {
      @Model()
      class DonorIntent extends SakuraApiModel {
        @Db() @Json()
        currency: string;

        @Db() @Json()
        email?: string;

        @Json({promiscuous: true})
        stripeToken?: any;

        @Json()
        stripeToken2?: any;

        @Db() @Json()
        donations: Array<{
          id: string;
          amount: number;
          recurring?: boolean;
        }>;
      }

      it('without sub document', () => {
        const testJson = {
          currency: 'USD',
          donations: [
            {
              amount: 6000,
              id: 'g',
              recurring: false
            }
          ],
          email: 'redacted@gmail.com'
        };
        const result = DonorIntent.fromJson(testJson);

        expect(result.currency).toBe(testJson.currency);
        expect(result.email).toBe(testJson.email);
        expect(result.stripeToken).toBeUndefined();
        expect(result.donations.length).toBe(1);
        expect(result.donations[0].id).toBe(testJson.donations[0].id);
        expect(result.donations[0].amount).toBe(testJson.donations[0].amount);
        expect(result.donations[0].recurring).toBe(testJson.donations[0].recurring);
      });

      it('with sub document', () => {
        const testJson = {
          currency: 'USD',
          donations: [
            {
              amount: 6000,
              id: 'g',
              recurring: false
            }
          ],
          email: 'redacted@gmail.com',
          stripeToken: {
            card: {
              address_city: 'redacted',
              address_country: 'United States',
              address_line1: 'redacted',
              address_line1_check: 'unchecked',
              address_line2: null,
              address_state: 'redacted',
              address_zip: 'redacted',
              address_zip_check: 'unchecked',
              brand: 'Visa',
              country: 'US',
              cvc_check: 'unchecked',
              dynamic_last4: null,
              exp_month: 11,
              exp_year: 2021,
              funding: 'credit',
              id: 'tok_visa',
              last4: '4242',
              metadata: {},
              name: null,
              object: 'card',
              tokenization_method: null
            },
            client_ip: '1.2.3.4',
            created: 1505528045,
            id: 'tok_visa',
            livemode: false,
            object: 'token',
            type: 'card',
            used: false
          }

        };

        const result = DonorIntent.fromJson(testJson);

        expect(result).toBeDefined();
        expect(result.currency).toBe(testJson.currency);
        expect(result.email).toBe(testJson.email);
        expect(result.stripeToken).toBeDefined();
        expect(result.stripeToken.id).toBe(testJson.stripeToken.id);
        expect(result.stripeToken.object).toBe(testJson.stripeToken.object);
        expect(result.stripeToken.card).toBeDefined();
        expect(result.stripeToken.card.id).toBe(testJson.stripeToken.card.id);
        expect(result.stripeToken.card.object).toBe(testJson.stripeToken.card.object);
        expect(result.stripeToken.card.address_city).toBe(testJson.stripeToken.card.address_city);
        expect(result.stripeToken.card.address_country).toBe(testJson.stripeToken.card.address_country);
        expect(result.stripeToken.card.address_line1).toBe(testJson.stripeToken.card.address_line1);
        expect(result.stripeToken.card.address_line1_check).toBe(testJson.stripeToken.card.address_line1_check);
        expect(result.stripeToken.card.address_line2).toBe(testJson.stripeToken.card.address_line2);
        expect(result.stripeToken.card.address_state).toBe(testJson.stripeToken.card.address_state);
        expect(result.stripeToken.card.address_zip).toBe(testJson.stripeToken.card.address_zip);
        expect(result.stripeToken.card.address_zip_check).toBe(testJson.stripeToken.card.address_zip_check);
        expect(result.stripeToken.card.brand).toBe(testJson.stripeToken.card.brand);
        expect(result.stripeToken.card.country).toBe(testJson.stripeToken.card.country);
        expect(result.stripeToken.card.cvc_check).toBe(testJson.stripeToken.card.cvc_check);
        expect(result.stripeToken.card.dynamic_last4).toBe(testJson.stripeToken.card.dynamic_last4);
        expect(result.stripeToken.card.exp_month).toBe(testJson.stripeToken.card.exp_month);
        expect(result.stripeToken.card.exp_year).toBe(testJson.stripeToken.card.exp_year);
        expect(result.stripeToken.card.funding).toBe(testJson.stripeToken.card.funding);
        expect(result.stripeToken.card.last4).toBe(testJson.stripeToken.card.last4);
        expect(result.stripeToken.card.metadata).toBe(testJson.stripeToken.card.metadata);
        expect(result.stripeToken.card.name).toBe(testJson.stripeToken.card.name);
        expect(result.stripeToken.card.tokenization_method).toBe(testJson.stripeToken.card.tokenization_method);
        expect(result.stripeToken.client_ip).toBe(result.stripeToken.client_ip);
        expect(result.stripeToken.created).toBe(testJson.stripeToken.created);
        expect(result.stripeToken.livemode).toBe(testJson.stripeToken.livemode);
        expect(result.stripeToken.type).toBe(testJson.stripeToken.type);
        expect(result.stripeToken.used).toBe(testJson.stripeToken.used);
        expect(result.donations.length).toBe(1);
        expect(result.donations[0].id).toBe(testJson.donations[0].id);
        expect(result.donations[0].amount).toBe(testJson.donations[0].amount);
        expect(result.donations[0].recurring).toBe(testJson.donations[0].recurring);

      });

      it('with sub document', () => {
        const testJson = {
          currency: 'USD',
          donations: [
            {
              amount: 6000,
              id: 'g',
              recurring: false
            }
          ],
          email: 'redacted@gmail.com',
          stripeToken2: {
            card: {
              address_city: 'redacted',
              address_country: 'United States',
              address_line1: 'redacted',
              address_line1_check: 'unchecked',
              address_line2: null,
              address_state: 'redacted',
              address_zip: 'redacted',
              address_zip_check: 'unchecked',
              brand: 'Visa',
              country: 'US',
              cvc_check: 'unchecked',
              dynamic_last4: null,
              exp_month: 11,
              exp_year: 2021,
              funding: 'credit',
              id: 'tok_visa',
              last4: '4242',
              metadata: {},
              name: null,
              object: 'card',
              tokenization_method: null
            },
            client_ip: '1.2.3.4',
            created: 1505528045,
            id: 'tok_visa',
            livemode: false,
            object: 'token',
            type: 'card',
            used: false
          }

        };

        const result = DonorIntent.fromJson(testJson);

        expect(result).toBeDefined();
        expect(result.currency).toBe(testJson.currency);
        expect(result.email).toBe(testJson.email);
        expect(result.stripeToken2).toBeDefined();
        expect(result.stripeToken2.id).toBe(testJson.stripeToken2.id);
        expect(result.stripeToken2.object).toBeUndefined();
        expect(result.stripeToken2.card).toBeUndefined();
        expect(result.stripeToken2.client_ip).toBeUndefined();
        expect(result.stripeToken2.created).toBeUndefined();
        expect(result.stripeToken2.livemode).toBeUndefined();
        expect(result.stripeToken2.type).toBeUndefined();
        expect(result.stripeToken2.used).toBeUndefined();
        expect(result.donations.length).toBe(1);
        expect(result.donations[0].id).toBe(testJson.donations[0].id);
        expect(result.donations[0].amount).toBe(testJson.donations[0].amount);
        expect(result.donations[0].recurring).toBe(testJson.donations[0].recurring);

      });
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
    class ChangeSetTest extends SakuraApiModel {

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
      expect(dbObj.lastName).toBe(json.ln);
      expect(dbObj.cn).toBeDefined('contact should have been included');
      expect(dbObj.cn.p).toBe('000');
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
  });

  describe('fromJsonArray', () => {
    it('from is injected into the model as a static member by default', () => {
      expect(Test.fromJsonArray).toBeDefined();
    });

    it('allows the injected functions to be overridden without breaking the internal dependencies', () => {
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
