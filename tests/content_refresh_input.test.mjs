import assert from 'node:assert/strict';
import test from 'node:test';

import { targetKey, validateRefreshInput } from '../api/_utils/content-refresh.js';

test('accepts and keys an ISO ex-date refresh', async () => {
    const input = await validateRefreshInput({ scope: 'ex_date', exDate: '2026-09-25' });
    assert.deepEqual(input, { scope: 'ex_date', exDate: '2026-09-25' });
    assert.equal(targetKey(input), 'ex-date:2026-09-25');
});

test('rejects a calendar-invalid ex-date', async () => {
    await assert.rejects(
        validateRefreshInput({ scope: 'ex_date', exDate: '2026-02-31' }),
        /valid ISO date/
    );
});
