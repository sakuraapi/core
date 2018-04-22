import { Db } from '../index';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.fromDbArray', () => {
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
