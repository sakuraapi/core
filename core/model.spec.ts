import {
  IModel,
  Model,
  modelSymbols
}               from './model';

describe('core/Model', function () {

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
      expect(this.t[modelSymbols.sakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.sakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(sakuraApiModel)' of object '#<Test>'`);
    });

    describe('injects default CRUD method', function () {
      @Model()
      class TestDefaultMethods implements IModel {
        static delete: (any) => (any) = null;
        static get: (any) => (any) = null;
        static getById: (any) => (any) = null;
      }

      beforeEach(function () {
        this.tdm = new TestDefaultMethods();
      });

      describe('when none provided by integrator', function () {
        it('static getById', function () {
          expect(TestDefaultMethods.delete('echo')).toBe('echo');
        });

        it('static get', function () {
          expect(TestDefaultMethods.get('echo')).toBe('echo');
        });

        it('static getById', function () {
          expect(TestDefaultMethods.getById('echo')).toBe('echo');
        });

        it('create', function () {
          expect(this.tdm.create('echo')).toBe('echo');
        });

        it('save', function () {
          expect(this.tdm.save('echo')).toBe('echo');
        });

        it('delete', function () {
          expect(this.tdm.save('echo')).toBe('echo');
        });
      });

      describe('but does not overwrite custom methods', function () {
        it('static methods', function () {
          expect(Test.getById()).toBe('custom');
        });

        it('static methods', function () {
          expect(this.t.save()).toBe('custom');
        });
      });

      describe('unless excluded by suppressInjection: [] in ModelOptions', function () {
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


