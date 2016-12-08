import {
  Model
}         from './model';

describe('core/Model', function () {

  describe('construction', function () {

    @Model()
    class Test {
      constructor(public n: number) {
      }
    }

    beforeEach(function () {
      this.t = new Test(777);
    });

    it('properly passes the constructor parameters', function () {
      expect(this.t.n).toBe(777);
    });

    it('maintains the prototype chain', function () {
      expect(this.t instanceof Test).toBe(true);
    });

    it('decorates itself with this.sakuraApiModel = true', function () {
      expect(this.t.sakuraApiModel).toBe(true);
    });

    it('sets its this.sakuraApiModel property to readonly', function () {
      expect(() => this.t.sakuraApiModel = false)
        .toThrow(new Error(`Cannot assign to read only property 'sakuraApiModel' of object '#<Test>'`));
    });
  });
});


