// SPDX-License-Identifier: MIT

pragma solidity =0.8.14;

// V2 Interfaces
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";

// V3 interfaces
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";

// V3 libraries
import "@uniswap/v3-core/contracts/libraries/SafeCast.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// Callback data
import "./libraries/UniswapCallbackData.sol";

/// @title Arbitrageur contract
/// @author h0tw4t3r.eth
contract Arbitrageur is IUniswapV2Callee, IUniswapV3SwapCallback {
    using LowGasSafeMath for uint;
    using LowGasSafeMath for int;
    using SafeCast for uint;
    using SafeCast for int;

    constructor() {}

    /// @notice Arbitrage method
    /// @dev When you're playing with the method by hands don't forget to increase the target block
    /// @param blockNumber Block number to target, revert if current block is bigger
    /// @param amount Amount of tokens to run
    /// @param baseToken Base token of arbitrage (i.e WETH->???->WETH)
    /// @param poolA First pool to swap (A->???->A)
    /// @param poolB Second pool to swap (???->B->???)
    /// @param typeA Type of the DEX (0 - UniswapV3, 1 - UniswapV2)
    function arbitrage(
        uint blockNumber,
        uint amount,
        address baseToken,
        address poolA,
        address poolB,
        uint8 typeA,
        uint8 typeB
    ) external {
        require(block.number <= blockNumber, "block");
        if (typeA == 0) {
            if (typeB == 1)
                return arbitrageV3toV2(amount, baseToken, poolA, poolB);
            else revert("NS");
        } else if (typeA == 1)
            return arbitrageV2toAny(amount, baseToken, poolA, poolB, typeB);
        else revert("NS");
    }

    /// @notice Modified getAmountOut method from UniswapV2 with fees
    /// @dev We're safe to cut the revert checks as if it is revertable, it will revert in the pair itself
    /// @param amountIn amount of tokens to swap
    /// @param reserveIn reserves of the input tokens in pair
    /// @param reserveOut reserves of the output tokens in pair
    /// @param feeNumerator fee numerator used in the underlying DEX router contract (i.e. PancakeSwap 9975/10000,
    /// UniswapV2 997/1000 - 9975 or 997)
    /// @param feeDenominator fee denominator used in the underlying DEX router contract (i.e. PancakeSwap 9975/10000,
    /// UniswapV2 997/1000 - 10000 or 1000)
    /// @return amountOut amount of tokens out
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut,
        uint feeNumerator,
        uint feeDenominator
    ) internal pure returns (uint amountOut) {
        uint amountInWithFee = amountIn.mul(feeNumerator);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(feeDenominator).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    /// @notice Modified exactInputSingle from V3SwapRouter
    /// @dev Reverts cut, and modified with respect of sqrtPriceLimitX96 always to be zero
    /// @param pool V3 Pool to swap with
    /// @param recipient recipient of the tokens
    /// @param amountIn amount to swap
    /// @param zeroForOne an ugly parameter which holds the direction of the trade with respect if tokens sorts before
    /// @param data the calldata we will decode in uniswapV3SwapCallback
    /// @return amountOut amount of out tokens
    function swapV3Pool(
        address pool,
        address recipient,
        uint amountIn,
        bool zeroForOne,
        bytes memory data
    ) internal returns (uint amountOut) {
        (int amount0, int amount1) = IUniswapV3Pool(pool).swap(
            recipient,
            zeroForOne,
            amountIn.toInt256(),
            (
                zeroForOne
                    ? /*MIN_SQRT_RATIO+1*/
                    4295128740
                    : /*MAX_SQRT_RATIO-1*/
                    1461446703485210103287273052203988822378723970341
            ),
            data
        );

        return uint(-(zeroForOne ? amount1 : amount0));
    }

    /// @notice initiates arbitrage from UniswapV2 to UniswapV{3,2}
    /// @param amount amount to arbitrage with
    /// @param baseToken address of the base token
    /// @param poolA Pool A (Contract->A->???->Contract)
    /// @param poolB Pool B (Contract->???->B->Contract)
    /// @param typeB Type of the Pool B (0 - UniswapV3, 1 - UniswapV2)
    function arbitrageV2toAny(
        uint amount,
        address baseToken,
        address poolA,
        address poolB,
        uint8 typeB
    ) internal {
        // sstore poolA for gas savings
        IUniswapV2Pair _poolA = IUniswapV2Pair(poolA);
        address token0 = _poolA.token0();

        // pack needed data to catch in uniswapV2Call
        bytes memory data = abi.encode(
            FlashV2CallbackData({
                baseToken: baseToken,
                poolB: poolB,
                typeB: typeB,
                eoa: msg.sender,
                amountA: amount /* ,
                feeNumerator: uint16((packedPoolBAndFeeInfo >> 176) & 0xFFFF),
                feeDenominator: uint16((packedPoolBAndFeeInfo >> 160) & 0xFFFF)
 */
            })
        );

        // calculating the target output amount (fees hardcoded atm)
        uint amount0Out;
        uint amount1Out;
        {
            (uint _reserve0, uint _reserve1, ) = _poolA.getReserves();
            amount0Out = baseToken == token0
                ? 0
                : getAmountOut(amount, _reserve1, _reserve0, 997, 1000);
            amount1Out = baseToken == token0
                ? getAmountOut(amount, _reserve0, _reserve1, 997, 1000)
                : 0;
        }

        // trigger the swap and catch the callback in uniswapV2Callback
        _poolA.swap(amount0Out, amount1Out, address(this), data);
    }

    /// @notice initiates arbitrage from UniswapV3 to UniswapV2 (V3-V3 not supported)
    /// @param amount amount to arbitrage with
    /// @param baseToken address of the base token
    /// @param poolA Pool A (Contract->A->???->Contract)
    /// @param poolB Pool B (Contract->???->B->Contract)
    function arbitrageV3toV2(
        uint amount,
        address baseToken,
        address poolA,
        address poolB
    ) internal {
        // sstore _poolA for gas savings
        IUniswapV3Pool _poolA = IUniswapV3Pool(poolA);
        address token0 = _poolA.token0();
        bool zeroForOne = baseToken <
            (baseToken == token0 ? _poolA.token1() : token0);
        // trigger the V3 swap and catch in uniswapV3SwapCallback
        swapV3Pool(
            poolA,
            poolB,
            amount,
            zeroForOne,
            abi.encode(
                FlashV3CallbackData({
                    swapType: 0,
                    baseToken: baseToken,
                    poolB: poolB,
                    eoa: msg.sender /* ,
                    feeNumerator: feeNumerator,
                    feeDenominator: feeDenominator */
                })
            )
        );
    }

    /// @notice uniswapV2Call hook which is called before checking V2 pair reserves
    /// @param contractAddress - contract which triggered the swap (= address(this))
    /// @param amount0 - amount of token0 swapped (zero or value)
    /// @param amount1 - amount of token1 swapped (zero or value)
    /// @param data - packed FlashV2CallbackData
    function uniswapV2Call(
        address contractAddress,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external override {
        IUniswapV2Pair _poolA = IUniswapV2Pair(msg.sender);
        address token0 = _poolA.token0();
        // decoding the encoded data
        FlashV2CallbackData memory decoded = abi.decode(
            data,
            (FlashV2CallbackData)
        );
        address tokenB = decoded.baseToken == token0 ? _poolA.token1() : token0;

        // figuring out if the amountB is in amount1 or amount0
        // as we swap only from one side to the other one of the amounts is always zero
        uint amountB = amount0 == 0 ? amount1 : amount0;
        uint amountC;
        bool sortsBefore = decoded.baseToken == token0;
        if (decoded.typeB == 0) {
            // UniswapV3-like case
            amountC = swapV3Pool(
                decoded.poolB,
                contractAddress,
                amountB,
                tokenB < decoded.baseToken,
                abi.encode(
                    NoFlashV3CallbackData({swapType: 1, tokenIn: tokenB})
                )
            );
        } else if (decoded.typeB == 1) {
            // UniswapV2 like case
            // can't sstore IUniswapV2Pair(decoded.poolB) because of the stack too deep
            TransferHelper.safeTransfer(tokenB, decoded.poolB, amountB);

            (uint _reserve0, uint _reserve1, ) = IUniswapV2Pair(decoded.poolB)
                .getReserves();
            amountC = getAmountOut(
                amountB,
                sortsBefore ? _reserve1 : _reserve0,
                sortsBefore ? _reserve0 : _reserve1,
                997,
                1000
            );
            IUniswapV2Pair(decoded.poolB).swap(
                sortsBefore ? amountC : 0,
                sortsBefore ? 0 : amountC,
                address(this), // stack too deep here so we won't use contractAddress
                new bytes(0)
            );
        }

        // check for the profit, if negative - revert
        require(amountC > decoded.amountA, "!profit");
        // transfering owed tokens back to the v2 pair
        TransferHelper.safeTransfer(
            decoded.baseToken,
            msg.sender,
            decoded.amountA
        );
        // transferring profit!
        TransferHelper.safeTransfer(
            decoded.baseToken,
            decoded.eoa,
            amountC.sub(decoded.amountA)
        );
    }

    function uniswapV3SwapCallback(
        int amount0Delta,
        int amount1Delta,
        bytes memory data
    ) external override {
        // uint8 will be encoded as uint256, therefore we are checking 32nd byte
        if (data[31] == 0x01) {
            // treat as no flash swap
            NoFlashV3CallbackData memory decodedNoFlash = abi.decode(
                data,
                (NoFlashV3CallbackData)
            );
            // pay for the swap
            TransferHelper.safeTransfer(
                decodedNoFlash.tokenIn,
                msg.sender,
                amount0Delta > 0 ? uint(amount0Delta) : uint(amount1Delta)
            );
            return;
        }

        // decode the data
        FlashV3CallbackData memory decoded = abi.decode(
            data,
            (FlashV3CallbackData)
        );

        address token0 = IUniswapV3Pool(msg.sender).token0();
        bool sortsBefore = decoded.baseToken == token0;

        uint amountA = uint(sortsBefore ? amount0Delta : amount1Delta);
        uint amountB = uint(sortsBefore ? -amount1Delta : -amount0Delta);

        uint amountC;
        {
            IUniswapV2Pair poolB = IUniswapV2Pair(decoded.poolB);
            (uint _reserve0, uint _reserve1, ) = poolB.getReserves();
            uint reserveIn = sortsBefore ? _reserve1 : _reserve0;
            uint reserveOut = sortsBefore ? _reserve0 : _reserve1;
            amountC = getAmountOut(amountB, reserveIn, reserveOut, 997, 1000);
            poolB.swap(
                sortsBefore ? amountC : 0,
                sortsBefore ? 0 : amountC,
                address(this),
                new bytes(0)
            );
        }

        // profit check
        require(amountC > amountA, "!profit");
        // return tokens back to V3 pool
        TransferHelper.safeTransfer(decoded.baseToken, msg.sender, amountA);
        // return the profit
        TransferHelper.safeTransfer(
            decoded.baseToken,
            decoded.eoa,
            amountC.sub(amountA)
        );
    }
}
