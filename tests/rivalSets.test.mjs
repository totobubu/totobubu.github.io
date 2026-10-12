import assert from 'node:assert/strict';
import test from 'node:test';

import { getRivalSet } from '../src/config/rivalSets.js';

const explicitSets = {
    TOPW: { underlying: 'QQQ', rivals: ['JEPQ', 'QQQI', 'MAGS'] },
    MSTY: { underlying: 'MSTR', rivals: ['MSII', 'MST', 'MSTW'] },
    LFGY: { underlying: 'BKCH', rivals: ['YBIT', 'CONY', 'MSTY'] },
    YMAX: { underlying: 'SPY', rivals: ['YMAG', 'ULTY', 'QDTY'] },
    JEPI: { underlying: 'SPY', rivals: ['SPYI', 'XYLD', 'GPIX'] },
    SCHE: { underlying: 'VWO', rivals: ['IEMG', 'EEM', 'SPEM'] },
};

for (const [symbol, expected] of Object.entries(explicitSets)) {
    test(`${symbol} uses its reviewed explicit rival set`, () => {
        assert.deepEqual(getRivalSet(symbol), expected);
    });
}

test('automatic same-underlying selection remains available', () => {
    const navItems = [
        { symbol: 'FOCAL', underlying: 'TEST', company: 'Fund', dataPaths: ['focal.json'] },
        { symbol: 'BRAVO', underlying: 'TEST', company: 'Fund', dataPaths: ['bravo.json'] },
        { symbol: 'ALPHA', underlying: 'TEST', company: 'Fund', dataPaths: ['alpha.json'] },
    ];

    assert.deepEqual(getRivalSet('FOCAL', null, navItems), {
        underlying: 'TEST',
        rivals: ['ALPHA', 'BRAVO'],
    });
});
