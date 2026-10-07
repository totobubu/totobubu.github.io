const MAX_RIVALS = 3;

// Curated selections take precedence where the order of comparable funds has
// been explicitly reviewed. Other cards derive their rivals from the same
// declared underlying in nav.json.
export const RIVAL_SETS = {
    TSLY: {
        underlying: 'TSLA',
        rivals: ['TSII', 'TEST', 'TSLW'],
    },
    MSTY: {
        underlying: 'MSTR',
        rivals: ['MSII', 'MST', 'MSTW'],
    },
};

export function getRivalSet(symbol, tickerInfo, navItems = []) {
    const normalizedSymbol = symbol?.toUpperCase();
    const configured = RIVAL_SETS[normalizedSymbol];
    if (configured) return configured;

    const navItem = navItems.find(
        (item) => item.symbol?.toUpperCase() === normalizedSymbol
    );
    const underlying = tickerInfo?.underlying ?? navItem?.underlying;
    if (!underlying) return null;

    const rivals = navItems
        .filter(
            (item) =>
                item.symbol?.toUpperCase() !== normalizedSymbol &&
                item.underlying === underlying &&
                item.company &&
                !item.noDividends &&
                !item.upcoming &&
                item.dataPaths?.[0]
        )
        .map((item) => item.symbol)
        .sort((left, right) => left.localeCompare(right))
        .slice(0, MAX_RIVALS);

    return rivals.length ? { underlying, rivals } : null;
}
