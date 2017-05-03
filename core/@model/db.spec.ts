import {
  Db,
  dbSymbols,
  Json
} from './';
import {Model} from './model';

import {ObjectID} from 'mongodb';
import {SakuraApiModel} from './sakura-api-model';

import {sapi} from '../../spec/helpers/sakuraapi';

describe('@Db', function() {

  it('takes a string for the fieldname or an IDbOptions if other options are needed', function() {
    class DbTestStringField {
      @Db('t1')
      test1 = 'test1';

      @Db({field: 't2'})
      test2 = 'test2';
    }

    const map = DbTestStringField[dbSymbols.dbByPropertyName];
    expect(map.get('test1').field).toBe('t1');
    expect(map.get('test2').field).toBe('t2');
  });

  describe('fromDb', function() {

    it('is injected as a static member of an @Model object by default', function() {
      @Model(sapi)
      class Test extends SakuraApiModel {
      }

      expect(Test.fromDb).toBeDefined();
    });

    it('handles falsy properties', function() {

      class Deep {
        @Db()
        deepValue;
      }

      @Model(sapi)
      class User extends SakuraApiModel {
        @Db()
        value;

        @Db()
        value2;

        @Db({model: Deep})
        deep = new Deep();
      }

      const db = {
        deep: {
          deepValue: false
        },
        value: 0,
        value2: false
      };

      const result = User.fromDb(db);

      expect(result.value).toBe(0);
      expect(result.value2).toBeDefined();
      expect(result.value2).toBeFalsy();
      expect(result.deep.deepValue).toBeDefined();
      expect(result.deep.deepValue).toBeFalsy();

    });

    describe('constructor', function() {

      @Model(sapi)
      class Test extends SakuraApiModel {

        constructor(public constructorTest?: number) {
          super();
        }
      }

      it('returns null on invalid input', function() {
        const result = Test.fromDb(null);
        expect(result).toBeNull();
      });

      it('constructs a new target object, passing along the constructor fields', function() {
        const result = Test.fromDb({}, {constructorArgs: [777]});
        expect(result.constructorTest).toBe(777);
      });

      it('returns an object of the correct instaceOf', function() {
        const result = Test.fromDb({}, 777);
        expect(result instanceof Test).toBe(true);
      });
    });

    describe('maps db fields to deeply nested model properties', function() {
      class Address {
        @Db('st')
        street = '1600 Pennsylvania Ave NW';

        @Db('c')
        city = 'Washington';

        @Db('s')
        state = 'DC';

        @Db('z')
        zip = '20500';

        @Db({field: 'gc', private: true})
        gateCode = 'a123';
      }

      class Order {
        @Db()
        orderId: string = 'a123';

        @Db()
        total: number = 100;

        @Db({field: 'addr', model: Address})
        address = new Address();

        itemName = 'Cherry Tree Axe';
      }

      @Model(sapi)
      class Test extends SakuraApiModel {

        @Db('fn')
        firstName: string;

        middleName: string;

        @Db({field: 'o', model: Order})
        order = new Order();
      }

      const input = {
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

      it('returns a model default property even if the Db source is missing that property', function() {
        class Contact {
          firstName: string = 'George';
          lastName: string = 'Washington';
        }

        @Model(sapi)
        class Test extends SakuraApiModel {
          @Db({model: Contact})
          contact: Contact = new Contact();
        }

        const result = Test.fromDb({});

        expect(result instanceof Test)
          .toBeTruthy(`the result should be an instance of the model '${Test.name}', instead it was a instance of `
            + `'${result.constructor.name}'`);

        expect(result).toBeDefined('an object should always result .fromDb({})');
        expect(result.contact).toBeDefined('a contact object should have been part of the result even though it ' +
          'was not part of the db input');
        expect(result.contact.firstName).toBe('George');
        expect(result.contact.lastName).toBe('Washington');
      });

      it('excludes fields without @Db model properties if not in promiscuous mode', function() {
        const result = Test.fromDb(input);

        expect(result.firstName).toBe(input.fn);
        expect(result.middleName).toBeUndefined('A property in a model should not be assigned a matching db '
          + 'field if the Model property is not decorated with @Db');
        expect((result as any).lastName)
          .toBeUndefined('A property without @Db should not be mapped from the db unless ' +
            'the Model is in promiscuous mode');
        expect(result.order.itemName)
          .toBe('Cherry Tree Axe', 'A default value should be set instead of the value from' +
            ' the db');
        expect((result.order as any).origin)
          .toBeUndefined('A property without @Db should not be mapped from the db unless ' +
            'the Model is in promiscuous mode');

      });

      it('throws when IDbOptions.model is invalid constructor function', function() {
        @Model(sapi)
        class TestModelOptionFail extends SakuraApiModel {
          @Db({model: {}})
          doh = new Order();
        }

        expect(() => TestModelOptionFail.fromDb({doh: {}}))
          .toThrow(Error(`Model 'TestModelOptionFail' has a property 'doh' that defines `
            + `its model with a value that cannot be constructed`));
      });

      it('maps objects with an IDbOptions.model option to an instance of that object constructor', function() {
        const result = Test.fromDb(input);

        expect(result.order instanceof Order).toBeTruthy('result.order should be instance of Order '
          + `but it was instance of '${result.order.constructor.name}' instead`);
        expect(result.order.address instanceof Address)
          .toBeTruthy('result.order.address should be instance of Address '
            + `but it was instance of '${result.order.address.constructor.name}' instead`);
      });

      it('deeply maps values with matching @Db', function() {

        const result = Test.fromDb(input);

        expect(result instanceof Test).toBeTruthy();
        expect(result.firstName).toBe(input.fn);
        expect(result.middleName).toBeUndefined('should not have mapped without promiscuous mode');
        expect((result as any).lastName).toBeUndefined('should not have mapped without promiscuous mode');
        expect(result.order).toBeDefined('result.order shold be defined');
        expect(result.order instanceof Order).toBeTruthy();
        expect(result.order.orderId).toBe('321');
        expect(result.order.total).toBe(200);
        expect(result.order.itemName).toBe('Cherry Tree Axe');
        expect((result.order as any).origin).toBeUndefined('should not have mapped without promiscuous mode');
        expect(result.order.address).toBeDefined('result.order.address should be defined');
        expect(result.order.address instanceof Address).toBeTruthy();
        expect(result.order.address.street).toBe('123');
        expect(result.order.address.city).toBe('Los Angeles');
        expect(result.order.address.state).toBe('CA');
        expect(result.order.address.zip).toBe('90277');
        expect(result.order.address.gateCode).toBe('00000');

      });

      it('handles properties with @Db({field}) set', function() {
        @Model(sapi)
        class Test {
          static fromDb;

          @Db({
            field: 'fn'
          })
          firstName: string;
          lastName: string;
        }

        const input = {
          fn: 'George',
          ln: 'Washington'
        };
        const result = Test.fromDb(input);

        expect(result.firstName).toBe(input.fn);
        expect(result.lastName).toBeUndefined();
      });

      describe('with dbOptions.promiscuous mode', function() {

        @Model(sapi, {
          dbConfig: {
            collection: 'users',
            db: 'UserDb',
            promiscuous: true
          }
        })
        class Test extends SakuraApiModel {
          @Db({field: 'ph'})
          phone: string;

          @Db({model: Order})
          order = new Order();
        }

        it('promiscuously includes fields not mapped with @Db', function() {
          const input = {
            firstName: 'George',
            lastName: 'Washington',
            order: {
              test: 777
            },
            ph: '123'
          };
          const result = Test.fromDb(input);

          expect((result as any).firstName).toBe(input.firstName);
          expect((result as any).lastName).toBe(input.lastName);
          expect(result.phone).toBe(input.ph);
          expect((result.order as any).test).toBe(777);
        });

        it('Properly return _id as instanceOf ObjectID', function() {

          const dbResult = {
            _id: new ObjectID().toString(),
            firstName: 'George',
            lastName: 'Washington',
            ph: '123'
          };

          const result = Test.fromDb(dbResult);

          expect((result as any).firstName).toBe(dbResult.firstName);
          expect((result as any).lastName).toBe(dbResult.lastName);
          expect(result.phone).toBe(dbResult.ph);
          expect(result._id.toString()).toBe(dbResult._id.toString());
          expect(result._id instanceof ObjectID).toBeTruthy('result._id should have been an instance of ObjectID');
        });
      });

      it('unmarshalls _id', function(done) {

        @Model(sapi)
        class Test extends SakuraApiModel {

          @Db({field: 'ph'})
          phone: string;
        }

        const data = {
          _id: new ObjectID(),
          ph: '1234567890'
        };

        const test = Test.fromDb(data);

        expect((test._id || 'missing _id').toString()).toBe(data._id.toString());
        expect((test.id || 'missing id').toString()).toBe(data._id.toString());
        done();
      });
    });

    describe('prunes model fields missing from db document in strict mode', function() {

      class Contact {
        @Db('ph')
        phone = '123-123-1234';

      }

      @Model(sapi, {
        dbConfig: {
          collection: 'fromDbStrictMode',
          db: 'userDb'
        }
      })
      class User extends SakuraApiModel {

        @Db('fn') @Json('f')
        firstName: string = 'George';

        @Db('ln') @Json('l')
        lastName: string = 'Washington';

        @Db({model: Contact}) @Json()
        contact = new Contact();

      }

      beforeEach(function(done) {
        sapi
          .dbConnections
          .connectAll()
          .then(() => User.removeAll({}))
          .then(() => {
            this.user = new User();
            return this.user.create();
          })
          .then(() => sapi.listen())
          .then(done)
          .catch(done.fail);
      });

      it('via projection', function(done) {
        const projection = {
          ln: 0
        };

        User
          .get({}, projection)
          .then((results) => {
            expect(results.length).toBe(1);
            expect(results[0].firstName).toBeDefined();
            expect(results[0].lastName).toBeUndefined('lastName should not have been included because projection ' +
              'excluded that field from the db results and the request was in strict mode');
            expect(results[0]._id).toBeDefined('There should have been an _id property');
            expect(results[0]._id.toString()).toBe(results[0].id.toString(), 'id property should be included if _id ' +
              'has a value');
            expect(results[0].contact.phone).toBe('123-123-1234');
          })
          .then(done)
          .catch(done.fail);
      });

      it('doesn\'t include id property if there\'s no _id', function(done) {
        const projection = {
          _id: 0
        };

        User
          .get({}, projection)
          .then((results) => {
            expect(results.length).toBe(1);
            expect(results[0]._id)
              .toBeUndefined('Projection should have prevented this field from being returned from the db');
            expect(results[0].id).toBeUndefined('id should not be present if _id is excluded from the db results');
          })
          .then(done)
          .catch(done.fail);
      });

      it('works with specifying projects for embedded documents', function(done) {
        const projection = {
          'contact.ph': 1
        };

        User.get({}, projection)
            .then((results) => {
              expect(results[0]._id instanceof ObjectID).toBeTruthy('Should be an instance of ObjectID');
              expect(results[0].firstName).toBeUndefined('Projection should have excluded this');
              expect(results[0].lastName).toBeUndefined('Projection should have excluded this');
              expect(results[0].contact.phone).toBe('123-123-1234');
            })
            .then(done)
            .catch(done.fail);
      });

    });
  });

  describe('fromDbArray', function() {
    @Model(sapi)
    class Test {
      static fromDbArray;

      @Db({
        field: 'fn'
      })
      firstName: string;
      @Db({
        field: 'ln'
      })
      lastName: string;

      constructor(public x) {
      }
    }

    it('takes an array of json and returns an array of Model objects', function() {
      const input = [
        {
          fn: 'George',
          ln: 'Washington'
        },
        {
          fn: 'John',
          ln: 'Adams'
        }
      ];

      const results = Test.fromDbArray(input, 777);
      expect(results.length).toBe(2);
      expect(results[0].firstName).toBe(input[0].fn);
      expect(results[0].lastName).toBe(input[0].ln);

      expect(results[1].firstName).toBe(input[1].fn);
      expect(results[1].lastName).toBe(input[1].ln);
    });

    it('returns an empty array if an invalid json input is passed in', function() {
      // tslint:disable-next-line:no-unused-expression
      const input = void(0);

      const result = Test.fromDbArray(input);
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(0);
    });
  });

  describe('toDb', function() {

    class Address {
      @Db('st')
      street = '1600 Pennsylvania Ave NW';
      @Db('c')
      city = 'Washington';
      @Db()
      state = 'DC';
      @Db({field: 'code', private: true})
      gateCode = '123';
      dogsName = 'Charlie';
    }

    class Order {
      @Db('on')
      orderNumber = 'a123';
      @Db('t')
      total = 100;
      @Db('adr')
      address: Address = new Address();
    }

    @Model(sapi, {
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: false // default
      }
    })
    class ChasteModelTest extends SakuraApiModel {

      @Db('fn')
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';
      @Db()
      order = new Order();
    }

    @Model(sapi, {
        dbConfig: {
          collection: 'users',
          db: 'userDb',
          promiscuous: true
        }
      }
    )
    class PromiscuousModelTest {
      @Db('fn')
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';
      order = new Order();
    }

    beforeEach(function() {
      this.promiscuousModel = new PromiscuousModelTest();
      this.promiscuousModel.id = new ObjectID();

      this.chasteModel = new ChasteModelTest();
      this.chasteModel.id = new ObjectID();
    });

    it('handles falsy properties', function() {
      const model = new ChasteModelTest();
      (model as any)['firstName'] = 0;
      (model as any)['lastName'] = false;

      const result = model.toDb();
      expect(result.fn).toBe(0);
      expect(result.lastName).toBeDefined();
      expect(result.lastName).toBeFalsy();
    });

    describe('Chaste Mode', function() {
      it('returns a db object with only explicit @Db fields, and does not include non-enumerable properties', function() {
        const result = this.chasteModel.toDb();

        expect(result._id).toBe(this.chasteModel.id);
        expect(result.fn).toBe(this.chasteModel.firstName);
        expect(result.lastName).toBe(this.chasteModel.lastName);
        expect(result.order).toBeDefined();
        expect(result.order.on).toBe(this.chasteModel.order.orderNumber);
        expect(result.order.t).toBe(this.chasteModel.order.total);
        expect(result.order.adr).toBeDefined();
        expect(result.order.adr.st).toBe(this.chasteModel.order.address.street);
        expect(result.order.adr.code).toBe(this.chasteModel.order.address.gateCode);
        expect(result.order.adr.dogsName).toBeUndefined();
        expect(result.phone).toBeUndefined();
        expect(result.id).toBeUndefined();

      });
    });

    describe('Promiscuous Mode (hey baby)', function() {
      it('returns a db object with all fields, but still respects @Db and does not include non-enumerable properties', function() {
        const result = this.promiscuousModel.toDb();

        expect(result._id).toBe(this.promiscuousModel.id);
        expect(result.fn).toBe(this.promiscuousModel.firstName);
        expect(result.lastName).toBe(this.promiscuousModel.lastName);
        expect(result.order).toBeDefined();
        expect(result.order.on).toBe(this.promiscuousModel.order.orderNumber);
        expect(result.order.t).toBe(this.promiscuousModel.order.total);
        expect(result.order.adr).toBeDefined();
        expect(result.order.adr.st).toBe(this.promiscuousModel.order.address.street);
        expect(result.order.adr.code).toBe(this.promiscuousModel.order.address.gateCode);
        expect(result.order.adr.dogsName).toBe(this.promiscuousModel.order.address.dogsName);
        expect(result.phone).toBe(this.promiscuousModel.phone);
        expect(result.id).toBeUndefined();
      });
    });

  });
});
