import { ObjectID } from 'mongodb';
import { Db } from '../db';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.toDb', () => {
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
    @Db({field: 'adr', model: Address})
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

  describe('IDbOptions', () => {
    describe('.model', () => {

      @Model()
      class ModelMapTest extends SapiModelMixin() {
        @Db({model: Order})
        order: Order[] = [];
      }

      it('array of sub documents - #167 ', () => {

        const dbData = {
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

        const test = ModelMapTest.fromDb(dbData).toDb();

        expect(test.order.length).toBe(2);
        expect(test.order[0].on).toBe(dbData.order[0].on);
        expect(test.order[0].t).toBe(dbData.order[0].t);

        expect(test.order[1].on).toBe(dbData.order[1].on);
        expect(test.order[1].t).toBe(dbData.order[1].t);

      });
    });
  });
});
