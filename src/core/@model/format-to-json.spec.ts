import {FormatToJson}   from './format-to-json';
import {Json}           from './json';
import {Model}          from './model';
import {Private}        from './private';
import {SapiModelMixin} from './sapi-model-mixin';

describe('@FormatToJson', () => {

  it('passes through json', () => {

    let wasCalled = false;

    @Model()
    class SomeModel extends SapiModelMixin() {

      @Json('f')
      firstName = 'John';
      @Json('l')
      lastName = 'Adams';

      @FormatToJson()
      formatter(json: any, model: any, context: string) {
        wasCalled = true;
        return json;
      }
    }

    const result = SomeModel.fromJson({}).toJson();

    expect(result.f).toBe('John');
    expect(result.l).toBe('Adams');
    expect(wasCalled).toBeTruthy();
  });

  it('allows modification of resulting json', () => {

    @Model()
    class SomeModel extends SapiModelMixin() {

      @Json('f')
      firstName = 'John';

      @Json('l')
      lastName = 'Adams';

      @Private()
      address = '123 Main St, Suite 101';

      @FormatToJson()
      inflateAddress(json: any, model: SomeModel, context: string) {

        const parts = (model.address || '').split(',');
        json.source = json.source || {};
        json.source.address1 = parts[0];
        json.source.address2 = (parts.length > 1) ? parts[1].trim() : undefined;

        return json;
      }
    }

    const result = SomeModel.fromJson({}).toJson();

    expect(result.f).toBe('John');
    expect(result.l).toBe('Adams');
    expect(result.source.address1).toBe('123 Main St');
    expect(result.source.address2).toBe('Suite 101');
    expect(result.address).toBeUndefined();
  });

  it('allows multiple decorations', () => {
    @Model()
    class SomeModel extends SapiModelMixin() {

      firstName: string;
      lastName: string;

      @FormatToJson()
      format1(json: any, model: any, context: string) {
        json.firstName = '1';
        return json;
      }

      @FormatToJson()
      format2(json: any, model: any, context: string) {
        json.lastName = '2';
        return json;
      }
    }

    const result = SomeModel.fromJson({}).toJson();

    expect(result.firstName).toBe('1');
    expect(result.lastName).toBe('2');
  });

  it('supports multiple contexts', () => {

    @Model()
    class SomeModel extends SapiModelMixin() {

      @Json('f')
      firstName: string;

      @FormatToJson()
      format1(json: any, model: any, context: string) {
        json.f = '1';
        return json;
      }

      @FormatToJson('source2')
      format2(json: any, model: any, context: string) {
        json.f = '2';
        return json;
      }
    }

    const result1 = SomeModel.fromJson({}).toJson();
    const result2 = SomeModel.fromJson({}).toJson('source2');

    expect(result1.f).toBe('1');
    expect(result2.f).toBe('2');

  });
});
