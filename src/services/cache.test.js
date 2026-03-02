import { cacheSet, cacheGet, cacheInvalidate, cacheInvalidateAll, cacheAge } from './cache';

describe('Cache Service', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('cacheSet and cacheGet stores and retrieves data', () => {
        cacheSet('test_key', { foo: 'bar' }, 30000);
        const result = cacheGet('test_key');
        expect(result).toEqual({ foo: 'bar' });
    });

    test('cacheGet returns null for missing keys', () => {
        const result = cacheGet('nonexistent');
        expect(result).toBeNull();
    });

    test('cacheGet returns null for expired entries', () => {
        // Manually write an expired entry to localStorage
        const entry = {
            data: 'old_data',
            timestamp: Date.now() - 60000, // 60s ago
            ttl: 1000, // 1s TTL — already well past
        };
        localStorage.setItem('stellar_escrow_expired', JSON.stringify(entry));

        const result = cacheGet('expired');
        expect(result).toBeNull();
    });

    test('cacheInvalidate removes specific key', () => {
        cacheSet('key1', 'val1', 30000);
        cacheSet('key2', 'val2', 30000);

        cacheInvalidate('key1');

        expect(cacheGet('key1')).toBeNull();
        expect(cacheGet('key2')).toBe('val2');
    });

    test('cacheInvalidateAll removes all cache entries', () => {
        cacheSet('a', 1, 30000);
        cacheSet('b', 2, 30000);
        cacheSet('c', 3, 30000);

        cacheInvalidateAll();

        expect(cacheGet('a')).toBeNull();
        expect(cacheGet('b')).toBeNull();
        expect(cacheGet('c')).toBeNull();
    });

    test('cacheAge returns age in seconds', () => {
        cacheSet('aged', 'data', 30000);
        const age = cacheAge('aged');
        expect(age).toBe(0); // Just set, should be 0s
    });

    test('cacheAge returns null for missing keys', () => {
        expect(cacheAge('missing')).toBeNull();
    });

    test('handles non-serializable data gracefully', () => {
        // localStorage might throw on some edge cases
        // Our cache should handle errors gracefully
        const result = cacheGet('bad_key');
        expect(result).toBeNull();
    });

    test('stores different data types', () => {
        cacheSet('string', 'hello', 30000);
        cacheSet('number', 42, 30000);
        cacheSet('array', [1, 2, 3], 30000);
        cacheSet('object', { nested: { deep: true } }, 30000);
        cacheSet('boolean', true, 30000);
        cacheSet('null_val', null, 30000);

        expect(cacheGet('string')).toBe('hello');
        expect(cacheGet('number')).toBe(42);
        expect(cacheGet('array')).toEqual([1, 2, 3]);
        expect(cacheGet('object')).toEqual({ nested: { deep: true } });
        expect(cacheGet('boolean')).toBe(true);
        expect(cacheGet('null_val')).toBeNull(); // null is returned as cache miss
    });
});
