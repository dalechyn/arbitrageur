// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";

/// @title Extended ISwapRouter02 with access to factory
interface ISwapRouterExtended is ISwapRouter, IPeripheryImmutableState {}
