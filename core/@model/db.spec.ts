import {Db} from './db';
import {Model} from './model';

import {ObjectID} from 'mongodb';

describe('@Db', function() {

  describe('fromDb', function() {

    it('is injected as a static member of an @Model object by default', function() {
      @Model()
      class Test {
        static fromDb;
      }

      expect(Test.fromDb).toBeDefined();
    });

    describe('constructor', function() {
      @Model()
      class Test {
        static fromDb;

        constructor(public constructorTest: number) {
        }
      }

      it('returns null on invalid input', function() {
        const result = Test.fromDb();
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
        @Model()
        class Test {
          static fromDb;
        }
        const result = Test.fromDb({});
        expect(result).toBeDefined();
      });

      it('handles properties with empty @Db options', function() {
        @Model()
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
        @Model()
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

      it('handles @Model being in dbOptions.promiscuous mode', function() {
        @Model({
          dbConfig: {
            collection: 'test',
            db: 'test',
            promiscuous: true
          }
        })
        class Test {
          static fromDb;

          @Db({field: 'ph'})
          phone: string;
        }

        const input = {
          firstName: 'George',
          lastName: 'Washington',
          ph: '123'
        };
        const result = Test.fromDb(input);

        expect(result.firstName).toBe(input.firstName);
        expect(result.lastName).toBe(input.lastName);
        expect(result.phone).toBe(input.ph);
      });
    });
  });

  describe('fromDbArray', function() {
    @Model()
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
    @Model({
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: false // default
      }
    })
    class ChasteModelTest {
      static toDb: () => any;

      @Db({
        field: 'fn'
      })
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';

    }

    @Model({
      dbConfig: {
        collection: 'users',
        db: 'userDb',
        promiscuous: true
      }
    })
    class PromiscuousModelTest {
      static toDb: () => any;

      @Db({
        field: 'fn'
      })
      firstName = 'George';
      @Db()
      lastName = 'Washington';
      phone = '555-123-1234';
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
        expect(result.phone).toBe(this.promiscuousModel.phone);
        expect(result.id).toBeUndefined();

      });
    });
  });
});
