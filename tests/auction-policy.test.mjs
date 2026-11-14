import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionBidAllowed, auctionDisposition, GUILD_LISTING } from '../src/lib/auction-policy.mjs';

test('categorías solicitadas y condiciones de anuncio', () => {
  assert.equal(auctionDisposition('7-1'), 'guild-market');
  for (const type of [2, 3, 4, 5, 8]) assert.equal(auctionDisposition(`${type}-1`), 'smelt');
  for (const basis of ['1-1', '12-1', '17-1', '7-1-malformado', null]) assert.equal(auctionDisposition(basis), null);
  assert.deepEqual(GUILD_LISTING, {price: 5000, hours: 24});
});

test('puja mínima solo con oro suficiente y sin repetir la propia oferta', () => {
  const bid = {basis:'7-1', amount:111, gold:25520, reserve:0, bidButton:true, immediate:false, ownBid:false};
  assert.equal(auctionBidAllowed(bid), true);
  for (const override of [{immediate:true}, {ownBid:true}, {bidButton:false}, {amount:0}, {gold:110}, {reserve:25410}, {basis:'1-1'}]) {
    assert.equal(auctionBidAllowed({...bid, ...override}), false);
  }
});
