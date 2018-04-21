import { testSapi } from '../../../../spec/helpers/sakuraapi';
import {
  Db,
  Json
} from '../index';
import { IJsonOptions } from '../json';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('@Model.fromJson', () => {
  describe('IJsonOptions.model', () => {
    it('model with default value will take default value if db returns field empty, issue #94', async (done) => {

      @Model()
      class Address {
        @Db('st') @Json()
        street = '1600 Pennsylvania Ave NW';

        @Db('c') @Json()
        city = 'Washington';

        @Db('s') @Json()
        state = 'DC';

        @Db('z') @Json()
        zip = '20500';

        @Db({field: 'gc', private: true})
        gateCode = 'a123';
      }

      @Model({dbConfig: {collection: 'users', db: 'userDb'}})
      class Test94 extends SapiModelMixin() {
        @Db({field: 'ad', model: Address}) @Json()
        address = new Address();
      }

      try {
        const sapi = testSapi({
          models: [Address, Test94]
        });
        await sapi.listen({bootMessage: ''});
        await Test94.removeAll({});

        const createResult = await Test94.fromJson({
          address: {
            city: '2',
            gateCode: '5',
            state: '3',
            street: '1',
            zip: '4'
          }
        }).create();
        const fullDoc = await Test94.getById(createResult.insertedId);

        expect(fullDoc.address.street).toBe('1');
        expect(fullDoc.address.city).toBe('2');
        expect(fullDoc.address.state).toBe('3');
        expect(fullDoc.address.zip).toBe('4');
        expect(fullDoc.address.gateCode).toBe('5');

        delete fullDoc.address;
        await fullDoc.save({ad: undefined});

        const updated = await Test94.getById(createResult.insertedId);
        updated.address = updated.address || {} as Address;

        const defaultAddress = new Address();

        expect(updated.address.street).toBe(defaultAddress.street);
        expect(updated.address.city).toBe(defaultAddress.city);
        expect(updated.address.state).toBe(defaultAddress.state);
        expect(updated.address.zip).toBe(defaultAddress.zip);
        expect(updated.address.gateCode).toBe(defaultAddress.gateCode);

        await sapi.close();
        done();
      } catch (err) {
        done.fail(err);
      }
    });
  });
});
