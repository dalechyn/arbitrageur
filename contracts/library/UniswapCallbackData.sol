// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

struct FlashV3CallbackData {
  address baseToken;
  address pair;
  address payer;
}

struct FlashV2CallbackData {
  address baseToken;
  address pool;
  address payer;
  uint amountA;
}