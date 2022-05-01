// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@uniswap/v3-periphery/contracts/interfaces/ITickLens.sol";
import "hardhat/console.sol";

/// @title MulticallTickLens - Aggregate results from multiple TickLens function calls
contract MulticallTickLens {
    ITickLens lens;

    constructor(address _lens) {
        lens = ITickLens(_lens);
    }

    function concat(ITickLens.PopulatedTick[] memory arr1, ITickLens.PopulatedTick[] memory arr2) internal pure returns(ITickLens.PopulatedTick[] memory) {
        ITickLens.PopulatedTick[] memory returnArr = new ITickLens.PopulatedTick[](arr1.length + arr2.length);

        uint i=0;
        for (; i < arr1.length; i++) {
            returnArr[i] = arr1[i];
        }

        uint j=0;
        while (j < arr2.length) {
            returnArr[i++] = arr2[j++];
        }

        return returnArr;
    }

    function getPopulatedTicks(
        address pool,
        int16 tickBitmapIndexStart,
        int16 tickBitmapIndexEnd
    ) external view returns (ITickLens.PopulatedTick[] memory populatedTicks) {
        for (; tickBitmapIndexStart <= tickBitmapIndexEnd; tickBitmapIndexStart++) {
            ITickLens.PopulatedTick[] memory ticks = lens.getPopulatedTicksInWord(
                pool,
                tickBitmapIndexStart);
            populatedTicks = concat(populatedTicks, ticks);
        }
        return populatedTicks;
    }
}