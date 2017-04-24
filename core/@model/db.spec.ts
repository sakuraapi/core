import {
  Db,
  dbSymbols
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

      it('properly constructs a new target object, passing along the constructor fields', function() {
        const result = Test.fromDb({}, 777);
        expect(result.constructorTest).toBe(777);
      });

      it('returns an object of the correct instaceOf', function() {
        const result = Test.fromDb({}, 777);
        expect(result instanceof Test).toBe(true);
      });
    });

    describe('maps fields from input', function() {

      it('handles @Models with no @Db properties', function() {
        @Model(sapi)
        class Test {
          static fromDb;
        }
        const result = Test.fromDb({});
        expect(result).toBeDefined();
      });

      it('handles properties with empty @Db options', function() {
        @Model(sapi)
        class Test {
          static fromDb;

          @Db()
          firstName: string;
        }

        const input = {
          firstName: 'George',
          lastName: 'Washington'
        };
        const result = Test.fromDb(input);

        expect(result.firstName).toBe(input.firstName);
        expect(result.lastName).toBeUndefined();
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
        }

        it('promiscuously includes fields not mapped with @Db', function() {
          const input = {
            firstName: 'George',
            lastName: 'Washington',
            ph: '123'
          };
          const result = Test.fromDb(input);

          expect((result as any).firstName).toBe(input.firstName);
          expect((result as any).lastName).toBe(input.lastName);
          expect(result.phone).toBe(input.ph);
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
          expect(((result._id instanceof ObjectID) ? 'is' : 'is not') + ' instance of ObjectID')
            .toBe('is instance of ObjectID');
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
    class ChasteModelTest {

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
