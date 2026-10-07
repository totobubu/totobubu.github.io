const MAX_RIVALS = 3;

export function getRivalSet(symbol, tickerInfo, navItems = []) {
    const normalizedSymbol = symbol?.toUpperCase();
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
