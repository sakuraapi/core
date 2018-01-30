import {testSapi}            from '../../../spec/helpers/sakuraapi';
import {Injectable}          from './injectable';
import {SapiInjectableMixin} from './sapi-injectable-mixin';

describe('SapiInjectableMixin', () => {

  it('allows inheritence', () => {
    @Injectable()
    class AnInjectedService extends SapiInjectableMixin() {

      decorateValue(s: string) {
        return `${s} decorated`;
      }

    }

    @Injectable()
    class BaseInjectable extends SapiInjectableMixin() {
      value: string = undefined;

      constructor(private srv: AnInjectedService) {
        super();
      }

      getValue(): string {
        return this.srv.decorateValue(this.value);
      }
    }

    @Injectable()
    class DerivedInjectable extends SapiInjectableMixin(BaseInjectable) {
      value = 'override';
    }

    const sapi = testSapi({
      providers: [
        AnInjectedService,
        BaseInjectable,
        DerivedInjectable
      ]
    });

    const injectable = sapi.getProvider(DerivedInjectable);

    expect(injectable.getValue()).toBe('override decorated');

  });
});
