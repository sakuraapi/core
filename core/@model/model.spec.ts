import {
  IModel,
  Model,
  modelSymbols
} from './model';
import {ObjectID} from 'mongodb';

describe('@Model', function () {

  @Model()
  class Test implements IModel {
    testProperty = true;

    static get: (any) => (any) = null;

    static getById() {
      return 'custom';
    }

    constructor(public n: number) {
    }

    save() {
      return 'custom';
    }
  }

  describe('construction', function () {

    beforeEach(function () {
      this.t = new Test(777);
    });

    it('properly passes the constructor parameters', function () {
      expect(this.t.n).toBe(777);
    });

    it('maintains the prototype chain', function () {
      expect(this.t instanceof Test).toBe(true);
    });

    it(`decorates itself with Symbol('sakuraApiModel') = true`, function () {
      expect(this.t[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
    });

    it('maps _id to id without contaminating the object properties with the id accessor', function () {
      this.t.id = new ObjectID();

      expect(this.t._id).toEqual(this.t.id);
      expect(this.t.id).toEqual(this.t.id);

      let json = JSON.parse(JSON.stringify(this.t));
      expect(json.id).toBeUndefined();
    });

    describe('ModelOptions.dbConfig', function () {
      it('throws when dbConfig.db is missing', function () {
        @Model({dbConfig: {}})
        class TestDbConfig {
        }

        expect(() => {
          new TestDbConfig();
        }).toThrow();
      });

      it('throws when dbConfig.collection is missing', function () {
        @Model({
          dbConfig: {
            db: 'test'
          }
        })
        class TestDbConfig {
        }

        expect(() => {
          new TestDbConfig();
        }).toThrow();
      });
    });

    describe('injects default CRUD method', function () {
      @Model({
        dbConfig: {
          db: 'userDb',
          collection: 'users'
        }
      })
      class TestDefaultMethods implements IModel {
        static delete: (any) => any;
        static get: (any) => any;
        static getById: (any) => any;

        firstName = 'fName';
        lastName = 'lName';
      }

      beforeEach(function () {
        this.tdm = new TestDefaultMethods();
      });

      describe('when none provided by integrator', function () {

        beforeEach(function (done) {
          this
            .sapi
            .dbConnections
            .connectAll()
            .then(done)
            .catch(done.fail);
        });

        describe('static', function () {
          xit('getById', function () {
            expect(TestDefaultMethods.delete('echo')).toBe('echo');
          });

          xit('get', function () {
            expect(TestDefaultMethods.get('echo')).toBe('echo');
          });

          xit('getById', function () {
            expect(TestDefaultMethods.getById('echo')).toBe('echo');
          });
        });

        describe('instance', function () {
          it('create', function (done) {
            let id = new ObjectID();
            this.tdm.id = id;

            this
              .tdm
              .create()
              .then((result) => {
                expect(result.insertedCount).toBe(1);
                this
                  .tdm
                  .getCollection()
                  .find({_id: id})
                  .limit(1)
                  .next()
                  .then((result) => {
                    expect(result._id).toEqual(this.tdm.id);
                    expect(result.fName).toBe(this.tdm.fName);
                    expect(result.lName).toBe(this.tdm.lName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch((err) => {
                done.fail(err);
              });
          });

          xit('save', function (done) {
            this
              .tdm
              .save({})
              .then((result) => {
                console.log(result);
                done();
              });
          });

          xit('delete', function () {
            expect(this.tdm.save('echo')).toBe('echo');
          });
        });
      });

      describe('but does not overwrite custom methods added by integrator', function () {
        it('static methods', function () {
          expect(Test.getById()).toBe('custom');
        });

        it('static methods', function () {
          expect(this.t.save()).toBe('custom');
        });
      });

      describe('allows integrator to exclude CRUD with suppressInjection: [] in ModelOptions', function () {
        @Model({suppressInjection: ['get', 'save']})
        class TestSuppressedDefaultMethods implements IModel {
        }

        beforeEach(function () {
          this.suppressed = new TestSuppressedDefaultMethods();
        });

        it('with static defaults', function () {
          expect(this.suppressed.get).toBe(undefined);
        });

        it('with instance defaults', function () {
          expect(this.suppressed.save).toBe(undefined);
        });
      })
    });
  });
});
