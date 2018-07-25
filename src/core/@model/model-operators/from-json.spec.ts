import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { Id } from '../id';
import { Db, Json } from '../index';
import { IJsonOptions } from '../json';
import { Model, modelSymbols } from '../model';
import { Private } from '../private';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('@Model.fromJson', () => {
  let test: Test;

  @Model({
    dbConfig: {
      collection: 'users',
      db: 'userDb',
      promiscuous: true
    }
  })
  class Test extends SapiModelMixin() {

    @Id() @Json({type: 'id'})
    id: ObjectID;

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

    @Json({field: 'c2', model: Contact})
    contact2 = new Contact();
  }

  beforeEach(() => {
    test = new Test();
  });

  it('is injected into the model as a static member by default', () => {
    expect(User.fromJson).toBeDefined();
  });

  it('allows the injected functions to be overridden without breaking the internal dependencies', () => {
    @Model()
    class SymbolTest extends SapiModelMixin() {
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

  it('maintains instanceOf', () => {
    const obj = User.fromJson({});

    expect(obj instanceof User).toBe(true);
  });

  it('does not throw if there are no @Json decorators', () => {
    @Model()
    class C extends SapiModelMixin() {
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

  it('maps a model property that has no @Json property, but does have a default value', () => {
    @Model()
    class TestDefaults extends SapiModelMixin() {
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

  it('returns null when no json object is provided', () => {
    expect(Test.fromJson(null)).toBe(null);
    expect(Test.fromJson(undefined)).toBe(null);
  });

  it('falsy json properties are not excluded in resulting model', () => {
    const json = {
      contact: {
        phone: 0
      },
      ln: 0
    };

    const result: User = User.fromJson(json);

    expect(result.lastName as any).toBe(0);
    expect(result.contact.phone as any).toBe(0);
  });

  describe('supports multiple @json decorators', () => {

    it('with only one of the @json properties used', () => {
      let obj = Test.fromJson({
        anp: 2
      });
      expect(obj.anotherProperty as any).toBe(2);

      obj = Test.fromJson({
        anotherProperty: 2
      });
      expect(obj.anotherProperty as any).toBe(2);
    });

    it('with the last property defined in the json object winning if there are multiple' +
      ' matching fields for a property', () => {
      const obj = Test.fromJson({
        anotherProperty: 3,
        anp: 2
      });
      expect(obj.anotherProperty as any).toBe(2);
    });

  });

  describe('bugs', () => {
    describe('#99, promiscuous fields', () => {
      @Model()
      class DonorIntent extends SapiModelMixin() {
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

    describe('#121', () => {

      it('should not take class property when `field` option is set', () => {
        pending('see #121 -- this needs to be evaluated and fixed');

        @Model({})
        class TestBug extends SapiModelMixin() {
          @Json({
            field: 'sp'
          })
          someProperty: string = 'default';
        }

        const result1 = TestBug.fromJson({sp: 'not-default-1'});

        expect(result1.someProperty).toBe('not-default-1');

        const result2 = TestBug.fromJson({someProperty: 'not-default-2'});
        expect(result2.someProperty).toBe('default');

      });

      it('#121', () => {
        pending('see #121 -- this needs to be evaluated and fixed');

        @Model({})
        class TestBug extends SapiModelMixin() {
          @Json({
            field: 'sp'
          })
          someProperty: string = 'default';
        }

        const result1 = TestBug.fromJson({sp: 'not-default-1'});
        expect(result1.someProperty).toBe('not-default-1');

        const result2 = TestBug.fromJson({
          someProperty: 'not-default-2-a',
          sp: 'not-default-2-b'
        });
        expect(result2.someProperty).toBe('not-default-2-b');

      });
    });
  });

  describe('id behavior', () => {

    @Model()
    class User1 extends SapiModelMixin() {
      @Id() @Json({type: 'id'})
      id: ObjectID;
    }

    it('unmarshalls id as an ObjectID when it is a valid ObjectID', () => {
      const data = {
        id: new ObjectID().toString()
      };

      const user = User1.fromJson(data);

      expect(user instanceof User1).toBeTruthy('Should have gotten back an instance of User');
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

  describe('formatFromJson', () => {
    it('flat objects', () => {

      let valCheck;
      let keyCheck;

      @Model()
      class TestFormat extends SapiModelMixin() {
        @Json({
          fromJson: (val, key) => {
            valCheck = val;
            keyCheck = key;
            return 'formatFromJson set1';
          }
        })
        someProperty: string = 'default';

        @Json({
          field: 'sop',
          fromJson: (val, key) => 'formatFromJson set2'
        })
        someOtherProperty: string = 'default';

        @Json({
          field: 'stp',
          fromJson: (val, key) => 'formatFromJson set3'
        })
        someThirdProperty: string = 'default';
      }

      const result = TestFormat.fromJson({
        someProperty: 'testValue',
        sop: 'testValue2'
      });

      expect(result.someProperty).toBe('formatFromJson set1');
      expect(valCheck).toBe('testValue');
      expect(keyCheck).toBe('someProperty');

      expect(result.someOtherProperty).toBe('formatFromJson set2');
      expect(result.someThirdProperty).toBe('default');
    });

    it('deep objects', () => {

      let valSet;
      let keySet;

      @Model()
      class TestDeep extends SapiModelMixin() {

        @Json()
        property1: string = 'default';

        @Json({
          fromJson: (val, key) => {
            valSet = val;
            keySet = key;

            return 'formatted-1';
          }
        })
        property2: string = 'default';
      }

      @Model()
      class TestFormat extends SapiModelMixin() {

        @Json({model: TestDeep})
        someProperty: TestDeep;
      }

      const result = TestFormat.fromJson({
        someProperty: {
          property1: 'hi',
          property2: 'yo'
        }
      });

      expect(result.someProperty.property1).toBe('hi');
      expect(result.someProperty.property2).toBe('formatted-1');
      expect(valSet).toBe('yo');
      expect(keySet).toBe('property2');

      const result2 = TestFormat.fromJson({
        someProperty: {
          property1: 'hi'
        }
      });

      expect(result2.someProperty.property1).toBe('hi');
      expect(result2.someProperty.property2).toBe('default');
      expect(valSet).toBe('yo');
      expect(keySet).toBe('property2');

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

      const testContext = TestContext.fromJson({fn: 'John', lastName: 'Adams'}, 'default');

      expect(testContext.firstName).toBe('John');
      expect(testContext.lastName).toBe('Adams');

    });

    it('falls back to using property names when an invalid context is passed in', () => {
      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('fn')
        firstName = 'George';

        @Json('ln') @Private()
        lastName = 'Washington';
      }

      const testContext = TestContext.fromJson({firstName: 'John', lastName: 'Adams'}, 'non-existent');

      expect(testContext.firstName).toBe('John');
      expect(testContext.lastName).toBe('Adams');
    });

    it('supports multiple contexts', () => {
      @Model()
      class TestContext extends SapiModelMixin() {
        @Json('fn', 'context1')
        @Json('fName', 'context2')
        firstName = 'George';

        @Private()
        @Json('ln', 'context2')
        lastName = 'Washington';
      }

      const result1 = TestContext.fromJson({fn: 'John', lastName: 'Adams'}, 'context1');
      const result2 = TestContext.fromJson({fName: 'Abigail', ln: 'Smith'}, 'context2');

      expect(result1.firstName).toBe('John');
      expect(result1.lastName).toBe('Adams');

      expect(result2.firstName).toBe('Abigail');
      expect(result2.lastName).toBe('Smith');

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

      const testContext = TestContext.fromJson({f: 'John', lastName: 'Adams'});

      expect(testContext.firstName).toBe('John');
      expect(testContext.lastName).toBe('Adams');
    });

    describe('* context', () => {
      it('can be set by @Json decorator', () => {

        @Model()
        class TestModel extends SapiModelMixin() {
          @Json('p1', 'context1')
          prop1;

          @Json('p2', '*')
          prop2;

          @Json('p3')
          prop3;
        }

        const data = {p1: 'val1', p2: 'val2', p3: 'val3'};
        const resultNoContext = TestModel.fromJson(data);
        expect(resultNoContext.prop1).toBeUndefined();
        expect(resultNoContext.prop2).toBe('val2');
        expect(resultNoContext.prop3).toBe('val3');

        const resultWithContext = TestModel.fromJson(data, 'context1');
        expect(resultWithContext.prop1).toBe('val1');
        expect(resultWithContext.prop2).toBe('val2');
        expect(resultWithContext.prop3).toBeUndefined();

      });

      describe('formatFromJson support', () => {
        let order = '';
        let prop1FormatterCalled = false;
        let prop2FormatterCalled = false;

        @Model()
        class TestModel extends SapiModelMixin() {
          @Json({
            context: 'context1',
            field: 'p1',
            fromJson: () => prop1FormatterCalled = true
          })
          prop1;

          @Json({
            context: '*',
            field: 'p2',
            fromJson: () => prop2FormatterCalled = true
          })
          prop2;

          @Json({
            context: 'context1',
            field: 'p3',
            fromJson: () => order += '1'
          })
          @Json({
            context: '*',
            field: 'p3',
            fromJson: () => order += '2'
          })
          prop3;
        }

        const data = {p1: 'val1', p2: 'val2', p3: 'val3'};

        afterEach(() => {
          order = '';
          prop1FormatterCalled = false;
          prop2FormatterCalled = false;
        });

        it('calls when no matching context but @Json context * present', () => {
          TestModel.fromJson(data);
          expect(prop1FormatterCalled).toBeFalsy();
          expect(prop2FormatterCalled).toBeTruthy();
        });

        it('calls when matching context', () => {
          TestModel.fromJson(data, 'context1');
          expect(prop1FormatterCalled).toBeTruthy();
          expect(prop2FormatterCalled).toBeTruthy();
        });

        it('calls more specific context then * context formatter', () => {
          TestModel.fromJson(data, 'context1');
          expect(order).toBe('12');
          expect(prop1FormatterCalled).toBeTruthy();
          expect(prop2FormatterCalled).toBeTruthy();
        });
      });
    });
  });

  describe('IJsonOptions', () => {

    describe('.model', () => {

      it('model with default value will take default value if db returns field empty, issue #94', async (done) => {

        @Model()
        class Address1 {
          @Db('st') @Json()
          street = '1600 Pennsylvania Ave NW';

          @Db('c') @Json()
          city = 'Washington';

          @Db('s') @Json()
          state = 'DC';

          @Db('z') @Json()
          zip = '20500';

          @Db({field: 'gc', private: true})
          gateCode = 'a123';
        }

        @Model({dbConfig: {collection: 'users', db: 'userDb'}})
        class Test94 extends SapiModelMixin() {
          @Id() @Json({type: 'id'})
          id: ObjectID;

          @Db({field: 'ad', model: Address1}) @Json()
          address = new Address1();
        }

        try {
          const sapi = testSapi({
            models: [Address1, Test94]
          });
          await sapi.listen({bootMessage: ''});
          await Test94.removeAll({});

          const createResult = await Test94.fromJson({
            address: {
              city: '2',
              gateCode: '5',
              state: '3',
              street: '1',
              zip: '4'
            }
          }).create();
          const fullDoc = await Test94.getById(createResult.insertedId);

          expect(fullDoc.address.street).toBe('1');
          expect(fullDoc.address.city).toBe('2');
          expect(fullDoc.address.state).toBe('3');
          expect(fullDoc.address.zip).toBe('4');
          expect(fullDoc.address.gateCode).toBe('5');

          delete fullDoc.address;
          await fullDoc.save({ad: undefined});

          const updated = await Test94.getById(createResult.insertedId);
          updated.address = updated.address || {} as Address1;

          const defaultAddress = new Address1();

          expect(updated.address.street).toBe(defaultAddress.street);
          expect(updated.address.city).toBe(defaultAddress.city);
          expect(updated.address.state).toBe(defaultAddress.state);
          expect(updated.address.zip).toBe(defaultAddress.zip);
          expect(updated.address.gateCode).toBe(defaultAddress.gateCode);

          await sapi.close();
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      it('properties can be null or undefined - issue #95', () => {

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
        class Parent extends SapiModelMixin() {

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

      describe('array of sub documents - #167', () => {
        const dbData = {
          fn: 'George',
          lastName: 'Washington',
          middleName: 'Nonely',
          o: {
            addr: {
              c: 'Los Angeles',
              gc: '00000',
              s: 'CA',
              st: '123',
              z: '90277'
            },
            itemName: 'Mid Sized Cherry Tree',
            orderId: '321',
            origin: 'Japan',
            total: 200
          }
        };

        @Model()
        class Address1 {
          @Json('st') @Json()
          street = '1600 Pennsylvania Ave NW';

          @Json('c') @Json()
          city = 'Washington';

          @Json('s') @Json()
          state = 'DC';

          @Json('z') @Json()
          zip = '20500';

          @Json({field: 'gc'})
          gateCode = 'a123';
        }

        // without @Model decoration, but still using @Db decorator
        class Order {
          @Json()
          orderId: string = 'a123';

          @Json()
          total: number = 100;

          @Json({field: 'addr', model: Address1})
          address = new Address1();

          itemName = 'Cherry Tree Axe';
        }

        class Lead {
          @Json('n')
          name: string;

          @Json({field: 'addr', model: Address1})
          address = new Address1();
        }

        @Model()
        class Test1 extends SapiModelMixin() {

          @Json('fn')
          firstName: string;

          middleName: string;

          @Json({field: 'o', model: Order})
          order = new Order();

          @Json({field: 'leads', model: Lead})
          leads: Lead[] = [];

        }

        it('if default value set, keeps default value if db source is missing that property', () => {
          const result = Test1.fromJson({});
          expect(Array.isArray(result.leads)).toBeTruthy('Should have defaulted to an empty array');
          expect(result.leads.length).toBe(0);
        });

        it('maps an array of sub documents from the DB to a resulting array of type model', () => {

          const leadSubDocs = [
            {
              addr: {
                c: 'Redondo Beach',
                gc: '00001',
                s: 'CA1',
                st: '123',
                z: '90277'
              },
              n: '1'
            },
            {
              addr: {
                c: 'Manhattan Beach',
                gc: '00002',
                s: 'CA2',
                st: '321',
                z: '90278'
              },
              n: '2'
            }
          ];
          const subDocDbData = Object.assign({leads: leadSubDocs}, dbData);

          const result = Test1.fromJson(subDocDbData);

          expect(result.leads.length).toBe(2);
          expect(result.leads[0] instanceof Lead).toBeTruthy('Should have been an instance of Lead');
          expect(result.leads[1] instanceof Lead).toBeTruthy('Should have been an instance of Lead');

          expect(result.leads[0].name).toBe(leadSubDocs[0].n);
          expect((result.leads[0].address || {} as any).city).toBe(leadSubDocs[0].addr.c);
          expect((result.leads[0].address || {} as any).gateCode).toBe(leadSubDocs[0].addr.gc);
          expect((result.leads[0].address || {} as any).state).toBe(leadSubDocs[0].addr.s);
          expect((result.leads[0].address || {} as any).street).toBe(leadSubDocs[0].addr.st);
          expect((result.leads[0].address || {} as any).zip).toBe(leadSubDocs[0].addr.z);

          expect(result.leads[1].name).toBe(leadSubDocs[1].n);
          expect((result.leads[1].address || {} as any).city).toBe(leadSubDocs[1].addr.c);
          expect((result.leads[1].address || {} as any).gateCode).toBe(leadSubDocs[1].addr.gc);
          expect((result.leads[1].address || {} as any).state).toBe(leadSubDocs[1].addr.s);
          expect((result.leads[1].address || {} as any).street).toBe(leadSubDocs[1].addr.st);
          expect((result.leads[1].address || {} as any).zip).toBe(leadSubDocs[1].addr.z);

        });
      });
    });
  });

  describe('decrypt', () => {

    const key = 'DFXkx2Vdi3FhZ;h24RE?,>O@Bm;~L7}(';

    @Model()
    class SubTestModel extends SapiModelMixin() {
      @Json()
      field1 = '1';
      field2 = 2;
    }

    @Model()
    class TestModel extends SapiModelMixin() {

      @Json({encrypt: true, key, type: 'id'})
      someId = new ObjectID();

      @Json({encrypt: true, key})
      secret = 'shhh';
    }

    @Model()
    class TestModelWithChild extends SapiModelMixin() {
      @Json({encrypt: true, key, model: SubTestModel})
      subModel = new SubTestModel();
    }

    it('decrypts simple values', () => {
      const model = new TestModel();
      const cipherText = model.toJson();
      const result = TestModel.fromJson(cipherText);

      expect(cipherText.secret).not.toBe(model.secret);
      expect(result.secret).toBe(model.secret);
    });

    it('decrypts complex values', () => {
      const model = new TestModelWithChild();
      const cipherText = model.toJson();
      const result = TestModelWithChild.fromJson(cipherText);

      expect(cipherText.subModel).not.toBe(model.subModel);
      expect(result.subModel.field1).toBe(model.subModel.field1);
      expect(result.subModel.field2).toBe(model.subModel.field2);
    });

    it('decrypts ObjectIDs', () => {
      const model = new TestModel();
      const cipherText = model.toJson();
      const result = TestModel.fromJson(cipherText);

      expect(cipherText.someId).not.toBe(model.someId);
      expect(result.someId.toHexString()).toEqual(model.someId.toHexString());
    });

    it('does not throw if value is null, #210', () => {
      const model = new TestModel();
      model.secret = null;
      const cipherText = model.toJson();
      const result = TestModel.fromJson(cipherText);

      expect(cipherText.secret).not.toBe(model.secret);
      expect(result.secret).toBe(model.secret);
    });

    it('does not throw if value is undefined, #210', () => {
      const model = new TestModel();
      model.secret = undefined;
      const cipherText = model.toJson();
      const result = TestModel.fromJson(cipherText);

      expect(cipherText.secret).toBe(model.secret);
      expect(result.secret).toBe(model.secret);
    });
  });

  describe('sparse', () => {
    it('only includes resulting fields from the source json', () => {

      const result = User.fromJson({
        fn: 'bob'
      }, null, {sparse: true});

      expect(Object.keys(result).length).toBe(1);
      expect(result.firstName).toBe('bob');
      expect(typeof result.toJson === 'function').toBeTruthy();
    });
  });
});
