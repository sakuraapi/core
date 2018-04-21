// tslint:disable:no-shadowed-variable
import { ObjectID } from 'mongodb';
import { testSapi } from '../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../sakura-api';
import {
  Db,
  dbSymbols,
  Json
} from './';
import { IDbOptions } from './db';
import { Model } from './model';
import { SapiModelMixin } from './sapi-model-mixin';

describe('@Db', () => {

  it('takes a string for the fieldname or an IDbOptions if other options are needed', () => {
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

  // TODO move to @model/model-operators/from-db-array.spec.ts per #168
  describe('fromDbArray', () => {
    @Model()
    class Test extends SapiModelMixin() {
      @Db({
        field: 'fn'
      })
      firstName: string;
      @Db({
        field: 'ln'
      })
      lastName: string;

    }

    it('takes an array of json and returns an array of Model objects', () => {
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

      const results = Test.fromDbArray(input);
      expect(results.length).toBe(2);
      expect(results[0].firstName).toBe(input[0].fn);
      expect(results[0].lastName).toBe(input[0].ln);

      expect(results[1].firstName).toBe(input[1].fn);
      expect(results[1].lastName).toBe(input[1].ln);
    });

    it('returns an empty array if an invalid json input is passed in', () => {
      // tslint:disable-next-line:no-unused-expression
      const input = void(0);

      const result = Test.fromDbArray(input);
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(0);
    });
  });

  // TODO move to @model/model-operators/to-db.spec.ts per #168
  describe('toDb', () => {
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

    @Model({
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: false // default
      }
    })
    class ChasteModelTest extends SapiModelMixin() {

      @Db('fn')
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';
      @Db()
      order = new Order();
    }

    @Model({
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: true
      }
    })
    class PromiscuousModelTest {
      @Db('fn')
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';
      order = new Order();
    }

    beforeEach(() => {
      this.promiscuousModel = new PromiscuousModelTest();
      this.promiscuousModel.id = new ObjectID();

      this.chasteModel = new ChasteModelTest();
      this.chasteModel.id = new ObjectID();
    });

    it('handles falsy properties', () => {
      const model = new ChasteModelTest();
      (model as any).firstName = 0;
      (model as any).lastName = false;

      const result = model.toDb();
      expect(result.fn).toBe(0);
      expect(result.lastName).toBeDefined();
      expect(result.lastName).toBeFalsy();
    });

    describe('Chaste Mode', () => {
      it('returns a db object with only explicit @Db fields, and does not include non-enumerable properties', () => {
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

    describe('Promiscuous Mode (hey baby)', () => {
      it('returns a db object with all fields, but still respects @Db and does not include non-enumerable properties', () => {
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
// tslint:enable:no-shadowed-variable
