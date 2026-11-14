// Política aislada: todavía no ejecuta pujas, ventas ni traslados.
export const AUCTION_TYPES = Object.freeze([7, 8, 4, 5, 2, 3]);
export const GUILD_LISTING = Object.freeze({ price: 5000, hours: 24 });

// Solo identifica el primer componente de data-basis si tiene formato conocido.
export function auctionItemType(basis) {
  const match = /^(\d+)-\d+$/.exec(String(basis ?? ''));
  return match ? Number(match[1]) : null;
}

export function auctionDisposition(basis) {
  const type = auctionItemType(basis);
  if (type === 7) return 'guild-market';
  if ([2, 3, 4, 5, 8].includes(type)) return 'smelt';
  return null;
}

// Una puja autorizada es una oferta en oro; nunca la compra inmediata.
export function auctionBidAllowed({ basis, amount, gold, reserve = 0, bidButton, immediate, ownBid }) {
  return AUCTION_TYPES.includes(auctionItemType(basis)) &&
    Number.isSafeInteger(amount) && amount > 0 &&
    Number.isSafeInteger(gold) && Number.isSafeInteger(reserve) && reserve >= 0 &&
    gold - amount >= reserve && bidButton === true && immediate === false && ownBid === false;
}
