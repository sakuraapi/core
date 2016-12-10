import {
  Model,
  modelSymbols
}               from './model';

describe('core/Model', function () {

  @Model()
  class Test {
    testProperty = true;

    static getById() {
      return 'getById';
    }

    constructor(public n: number) {
    }

    save() {
      return 'override';
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
        .toThrowError(`Cannot assign to read only property 'Symbol(sakuraApiModel)' of object '[object Object]'`);
    });

    it('proxies various CRUD methods so that a @model has basic CRUD out of the box', function () {

      // static
      expect((<any>Test).get('get_inserted')).toBe('get_inserted');
      expect(Test.getById()).toBe('getById');

      // instance
      expect(this.t.save()).toBe('override');
      expect(this.t.deleteById('delete_By_Id_Called')).toBe('delete_By_Id_Called');
      expect(() => this.t.failTest()).toThrow();

    });

  });
});


