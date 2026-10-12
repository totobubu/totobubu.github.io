const MAX_RIVALS = 3;

// Portfolio ETFs do not have one investable single-stock underlying. Keep
// product-level comparisons explicit where a reviewed benchmark is available.
const EXPLICIT_RIVAL_SETS = {
    TOPW: {
        underlying: 'QQQ',
        rivals: ['JEPQ', 'QQQI', 'MAGS'],
    },
};

export function getRivalSet(symbol, tickerInfo, navItems = []) {
    const normalizedSymbol = symbol?.toUpperCase();
    const explicitSet = EXPLICIT_RIVAL_SETS[normalizedSymbol];
    if (explicitSet) return explicitSet;

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
