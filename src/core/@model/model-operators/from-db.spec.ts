import { ObjectID } from 'mongodb';
import {
  Db,
  Json
} from '../';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('@Model.fromDb', () => {

  it('is injected as a static member of an @Model object by default', () => {
    @Model()
    class Test extends SapiModelMixin() {
    }

    expect(Test.fromDb).toBeDefined();
  });

  it('maps _id to id', (done) => {

    @Model()
    class Test extends SapiModelMixin() {

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

  describe('constructor', () => {
    @Model()
    class Test extends SapiModelMixin() {
      val = 777;
    }

    it('returns null on invalid input', () => {
      const result = Test.fromDb(null);
      expect(result).toBeNull();
    });

    it('constructs a new target object, passing along the constructor fields', () => {
      const result = Test.fromDb({});
      expect(result.val).toBe(777);
    });

    it('returns an object of the correct instaceOf', () => {
      const result = Test.fromDb({});
      expect(result instanceof Test).toBe(true);
    });
  });

  describe('prunes model fields missing from db document in strict mode', () => {

    class Contact {
      @Db('ph')
      phone = '123-123-1234';

    }

    @Model({
      dbConfig: {
        collection: 'fromDbStrictMode',
        db: 'userDb'
      }
    })
    class User extends SapiModelMixin() {

      @Db('fn') @Json('f')
      firstName: string = 'George';

      @Db('ln') @Json('l')
      lastName: string = 'Washington';

      @Db({model: Contact}) @Json()
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
        .then(() => {
          this.user = new User();
          return this.user.create();
        })
        .then(() => sapi.listen({bootMessage: ''}))
        .then(() => {
          sapi
            .close()
            .then(done)
            .catch(done.fail);
        })
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

    it('via projection', (done) => {
      const projection = {
        ln: 0
      };

      User
        .get({filter: {}, project: projection})
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

    it('doesn\'t include id property if there\'s no _id', (done) => {
      const projection = {
        _id: 0
      };

      User
        .get({filter: {}, project: projection})
        .then((results) => {
          expect(results.length).toBe(1);
          expect(results[0]._id)
            .toBeUndefined('Projection should have prevented this field from being returned from the db');
          expect(results[0].id).toBeUndefined('id should not be present if _id is excluded from the db results');
        })
        .then(done)
        .catch(done.fail);
    });

    it('works with specifying projects for embedded documents', (done) => {
      const projection = {
        'contact.ph': 1
      };

      User.get({filter: {}, project: projection})
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

  describe('IDbOptions', () => {

    it('.field', () => {
      @Model()
      class Test extends SapiModelMixin() {

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

    describe('.model', () => {

      const data = {
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
      class Address {
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

      class Order {
        @Db()
        orderId: string = 'a123';

        @Db()
        total: number = 100;

        @Db({field: 'addr', model: Address})
        address = new Address();

        itemName = 'Cherry Tree Axe';
      }

      @Model()
      class Test extends SapiModelMixin() {

        @Db('fn')
        firstName: string;

        middleName: string;

        @Db({field: 'o', model: Order})
        order = new Order();
      }

      it('if set, keeps default value if db source is missing that property', () => {
        class Contact {
          firstName: string = 'George';
          lastName: string = 'Washington';
        }

        @Model()
        class Test extends SapiModelMixin() {
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

      it('excludes fields without @Db decorated properties if not in promiscuous mode', () => {

        const result = Test.fromDb(data);

        expect(result.firstName).toBe(data.fn);

        expect(result.middleName).toBeUndefined('' +
          'A property in a model should not be assigned a matching db field if the Model property is not decorated with @Db'
        );

        expect((result as any).lastName).toBeUndefined(
          'A property without @Db should not be mapped from the db unless the Model is in promiscuous mode'
        );

        expect(result.order.itemName).toBe(
          'Cherry Tree Axe',
          'A default value should be set instead of the value from the db'
        );

        expect((result.order as any).origin).toBeUndefined(
          'A property without @Db should not be mapped from the db unless the Model is in promiscuous mode'
        );

      });

      it('throws when IDbOptions.model is invalid constructor function', () => {
        @Model()
        class TestModelOptionFail extends SapiModelMixin() {
          @Db({model: {}})
          doh = new Order();
        }

        expect(() => TestModelOptionFail.fromDb({doh: {}})).toThrow(
          Error(`Model 'TestModelOptionFail' has a property 'doh' that defines its model with a value that cannot be constructed`)
        );
      });

      it('maps objects with an IDbOptions.model option to an instance of that object constructor', () => {
        const result = Test.fromDb(data);

        expect(result.order instanceof Order).toBeTruthy(
          `result.order should be instance of Order but it was instance of '${result.order.constructor.name}' instead`
        );

        expect(result.order.address instanceof Address).toBeTruthy(
          `result.order.address should be instance of Address but it was instance of '${result.order.address.constructor.name}' instead`
        );
      });

      it('deeply maps values with matching @Db', () => {

        const result = Test.fromDb(data);

        expect(result instanceof Test).toBeTruthy();
        expect(result.firstName).toBe(data.fn);
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

      it('model with default value will take default value if db returns field empty, issue #94', async (done) => {

        @Model({dbConfig: {collection: 'users', db: 'userDb'}})
        class Test94 extends SapiModelMixin() {
          @Db({field: 'ad', model: Address}) @Json()
          address = new Address();
        }

        try {
          const sapi = testSapi({
            models: [Address, Test94]
          });
          await sapi.listen({bootMessage: ''});
          await Test94.removeAll({});

          const createResult = await Test94.fromDb({
            ad: {
              c: '2',
              gc: '5',
              s: '3',
              st: '1',
              z: '4'
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
          updated.address = updated.address || {} as Address;

          const defaultAddress = new Address();

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

      it('falsy values are mapped to resulting model rather than being skipped', () => {

        class Deep {
          @Db()
          deepValue;
        }

        @Model()
        class User extends SapiModelMixin() {
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

      describe('with dbOptions.promiscuous mode', () => {

        @Model({
          dbConfig: {
            collection: 'users',
            db: 'UserDb',
            promiscuous: true
          }
        })
        class Test extends SapiModelMixin() {
          @Db({field: 'ph'})
          phone: string;

          @Db({model: Order})
          order = new Order();
        }

        it('promiscuously includes fields not mapped with @Db', () => {
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

        it('Properly return _id as instanceOf ObjectID', () => {

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
    });
  });
});
