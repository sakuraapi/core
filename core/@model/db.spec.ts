import {Model} from './model';
import {Db} from './db';

describe('@Db', function () {

  describe('fromDb', function () {

    it('is injected as a static member of an @Model object by default', function () {
      @Model()
      class Test {
        static fromDb;
      }

      expect(Test.fromDb).toBeDefined();
    });

    describe('constructor', function () {
      @Model()
      class Test {
        static fromDb;

        constructor(public constructorTest: number) {
        }
      }

      it('returns null on invalid input', function () {
        let result = Test.fromDb();
        expect(result).toBeNull();
      });

      it('properly constructs a new target object, passing along the constructor fields', function () {
        let result = Test.fromDb({}, 777);
        expect(result.constructorTest).toBe(777);
      });

      it('returns an object of the correct instaceOf', function () {
        let result = Test.fromDb({}, 777);
        expect(result instanceof Test).toBe(true);
      });
    });

    describe('maps fields from input', function () {

      it('handles @Models with no @Db properties', function () {
        @Model()
        class Test {
          static fromDb;
        }
        let result = Test.fromDb({});
        expect(result).toBeDefined();
      });

      it('handles properties with empty @Db options', function () {
        @Model()
        class Test {
          static fromDb;

          @Db()
          firstName: string;
        }

        let input = {
          firstName: 'George',
          lastName: 'Washington'
        };
        let result = Test.fromDb(input);

        expect(result.firstName).toBe(input.firstName);
        expect(result.lastName).toBeUndefined();
      });

      it('handles properties with @Db({field}) set', function () {
        @Model()
        class Test {
          static fromDb;

          @Db({
            field: 'fn'
          })
          firstName: string;
          lastName: string;
        }

        let input = {
          fn: 'George',
          ln: 'Washington'
        };
        let result = Test.fromDb(input);

        expect(result.firstName).toBe(input.fn);
        expect(result.lastName).toBeUndefined();
      });

      it('handles @Model being in dbOptions.promiscuous mode', function () {
        @Model({
          dbConfig: {
            db: 'test',
            collection: 'test',
            promiscuous: true
          }
        })
        class Test {
          static fromDb;
        }

        let input = {
          firstName: 'George',
          lastName: 'Washington'
        };
        let result = Test.fromDb(input);

        expect(result.firstName).toBe(input.firstName);
        expect(result.lastName).toBe(input.lastName);
      });
    });
  });
});
