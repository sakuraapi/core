import {SanitizeMongoDB} from './';

describe('core/security/mongo-db', function() {

  describe('removeAll$Keys', function() {

    it('returns null and undefined untouched', function() {
      expect(SanitizeMongoDB.removeAll$Keys(null)).toBe(null);
      expect(SanitizeMongoDB.removeAll$Keys(undefined)).toBe(undefined);
    });

    it('returns numbers and strings untouched', function() {
      let stringInput = `{$where:'this.field === this.field'}`;
      let numberInput = 777;

      expect(SanitizeMongoDB.removeAll$Keys(stringInput)).toBe(stringInput);
      expect(SanitizeMongoDB.removeAll$Keys(numberInput)).toBe(numberInput);
    });

    it('removes top level object keys starting with $', function() {
      let obj = {
        firstName: 'Geroge',
        lastName: 'Washington',
        $where: function() {
          /*do something bad*/
        }
      };

      let result = SanitizeMongoDB.removeAll$Keys(obj);

      expect(result.$where).toBeUndefined();
      expect(result.firstName).toBe(obj.firstName);
      expect(result.lastName).toBe(obj.lastName);
    });

    it('deep inspects object for $ fields and removes them', function() {
      let obj = {
        firstName: 'Geroge',
        lastName: 'Washington',
        inner: {
          color: 'red',
          number: 777,
          innerInner: {
            $where: function() {
              /*do something bad*/
            }
          }
        }
      };

      let result = SanitizeMongoDB.removeAll$Keys(obj);

      expect(result.firstName).toBe(obj.firstName);
      expect(result.lastName).toBe(obj.lastName);
      expect(result.inner).toBeDefined();
      expect(result.inner.color).toBe(obj.inner.color);
      expect(result.inner.number).toBe(obj.inner.number);
      expect(result.inner.innerInner.$where).toBeUndefined();
    });
  });
});
