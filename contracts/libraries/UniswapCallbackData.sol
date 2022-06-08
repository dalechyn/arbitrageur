// SPDX-License-Identifier: MIT

pragma solidity =0.8.14;

struct FlashV3CallbackData {
  uint8 swapType; // 0 
  address baseToken;
  address poolB;
  address eoa;
/*   uint16 feeNumerator;
  uint16 feeDenominator; */
}

struct NoFlashV3CallbackData {
  uint8 swapType; // 1 
  address tokenIn;
}

struct FlashV2CallbackData {
  address baseToken;
  address poolB;
  address eoa; // eoa address that triggers the abritrage
  // 1 - V3; 2 - V2
  // in this order payer and uint8 should pack in one slot since ^0.8.0 since
  // address there is 40bytes-long underneath.
  uint8 typeB;
/*   uint16 feeNumerator;
  uint16 feeDenominator; */
  uint amountA;
}