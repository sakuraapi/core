import {
  Json,
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
      expect(this.t[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
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

describe('core/Model:Json & core/Mode.toJson[String]', function () {

  @Model()
  class Test {

    @Json('ap')
    aProperty: string = 'test';

    @Json('anp')
    anotherProperty: string;

    aThirdProperty: number = 777;

    aFunction() {

    }
  }

  @Model()
  class Test2 {
    aProperty: string = 'test';
    anotherProperty: string;
    aThirdProperty: number = 777;

    aFunction() {
    }
  }

  beforeEach(function () {
    this.t = new Test();
    this.t2 = new Test2();
  });

  it('transforms a defined property to the designated fieldName in the output of toJson', function () {
    expect(this.t.toJson().ap).toBe('test');
    expect(this.t.toJson().anp).toBeUndefined();
    expect(this.t.toJson().aThirdProperty).toBe(777);
    expect(this.t.toJson().aFunction).toBeUndefined();

    expect(this.t.aProperty).toBe('test');
    expect(this.t.anotherProperty).toBeUndefined();
    expect(this.t.aThirdProperty).toBe(777);
  });


  it('transforms a defined property to the designated fieldName in the output of toJsonString', function () {
    let result = JSON.parse(this.t.toJsonString())

    expect(result.ap).toBe('test');
    expect(result.anp).toBeUndefined();
    expect(result.aThirdProperty).toBe(777);
  });

  it('works like a normal object when not decorated with @Json properties', function () {
    expect(this.t2.toJson().aProperty).toBe('test');
    expect(this.t2.toJson().anotherProperty).toBeUndefined();
    expect(this.t2.toJson().aThirdProperty).toBe(777);
    expect(this.t2.toJson().aFunction).toBeUndefined();
  });
});


