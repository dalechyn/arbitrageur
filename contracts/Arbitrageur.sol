// SPDX-License-Identifier: MIT

pragma solidity =0.8.14;

// V2 Interfaces
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

// V3 interfaces
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
// An extended V3 SwapRouter interface
import "./interfaces/ISwapRouterExtended.sol";

// V3 libraries
import "@uniswap/v3-core/contracts/libraries/SafeCast.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// Callback data
import "./libraries/UniswapCallbackData.sol";
import "./periphery/PeripheryPayments14.sol";
import "./libraries/TickMath14.sol";

// debugging
import "hardhat/console.sol";

contract Arbitrageur is
    IUniswapV2Callee,
    IUniswapV3SwapCallback,
    PeripheryPayments14
{
    using LowGasSafeMath for uint;
    using LowGasSafeMath for int;
    using SafeCast for uint;
    using SafeCast for int;

    constructor(ISwapRouterExtended _uniswapV3Router)
        PeripheryImmutableState14(_uniswapV3Router.factory(), _uniswapV3Router.WETH9())
    {}

    function arbitrage(
        uint blockNumber,
        uint amount,
        // contains packed 2byte fee numerator, 2byte fee denominator and base token address
        // contains packed pool types:
        // 1 - UniV3 alike
        // 2 - UniV2 alike
        uint packedPoolTypesAndBaseTokenAndFeeInfo,
        address poolA,
        uint packedPoolBAndFeeInfo
    ) external {
        require(block.number <= blockNumber, "block");
        uint8 inType = uint8((packedPoolTypesAndBaseTokenAndFeeInfo >> 192) & 0x1);
        uint8 outType = uint8((packedPoolTypesAndBaseTokenAndFeeInfo >> 191) & 0x1);
        if (inType == 0) {
            if (outType == 1) return arbitrageV2toAny(amount, packedPoolTypesAndBaseTokenAndFeeInfo, poolA, packedPoolBAndFeeInfo, outType);
        } else {
            if (outType == 0) return arbitrageV3toV2(amount, packedPoolTypesAndBaseTokenAndFeeInfo, poolA, address(uint160(packedPoolBAndFeeInfo & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)));
        }
    }

    // copy from uniswapv2 library with custom fees
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint feeNumerator, uint feeDenominator) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(feeNumerator);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(feeDenominator).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    /// copied from v3pool
    /// @dev Performs a single exact input swap
    function swapV3Pool(
        address pool,
        uint256 amountIn,
        address recipient,
        uint160 sqrtPriceLimitX96,
        bool zeroForOne
    ) private returns (uint256 amountOut) {
        // allow swapping to the router address with address 0
        if (recipient == address(0)) recipient = address(this);

        (int256 amount0, int256 amount1) =
            IUniswapV3Pool(pool).swap(
                recipient,
                zeroForOne,
                amountIn.toInt256(),
                sqrtPriceLimitX96 == 0
                    ? (zeroForOne ? TickMath14.MIN_SQRT_RATIO + 1 : TickMath14.MAX_SQRT_RATIO - 1)
                    : sqrtPriceLimitX96,
                new bytes(0)
            );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // initiates swap for V2 pair for any amount of tokens (a.k.a flash-swap),
    // and swaps to V3, sending the borrowed amount back to the pool.
    // see uniswapV2Callback for the next implementation, as pair triggers
    // the callback before checking pair reserve balances
    function arbitrageV2toAny(
        uint amount,
        uint packedBaseTokenAndFeeInfo, // fee num and den for dex0
        address poolA,
        uint packedPoolBAndFeeInfo, // fee num and den for dex1
        uint8 outType
    ) internal {
        require(poolA != address(0), "!poolA");
        // address is 20bytes*8=160bits, with encoded at the beginning 2 byte feeNum and feeDen
        address baseToken = address(uint160(packedBaseTokenAndFeeInfo & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF));

        address token0 = IUniswapV2Pair(poolA).token0();

        // need to pass some data to trigger uniswapV2Call
        bytes memory data = abi.encode(
            FlashV2CallbackData({
                baseToken: baseToken,
                pool: address(uint160(packedPoolBAndFeeInfo & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)),
                payer: msg.sender,
                outType: outType,
                // saving the amount of tokens to input (WETH for the current bot implementation)
                // in order to check if the trade was profitable
                amountA: amount,
                feeNumerator: uint16((packedPoolBAndFeeInfo >> 176) & 0xFFFF),
                feeDenominator: uint16((packedPoolBAndFeeInfo >> 160) & 0xFFFF)
            })
        );

        uint amount0Out; uint amount1Out;
        { 
            uint feeNumerator = (packedBaseTokenAndFeeInfo >> 176) & 0xFFFF;
            uint feeDenominator = (packedBaseTokenAndFeeInfo >> 160) & 0xFFFF;
            (uint _reserve0, uint _reserve1,) = IUniswapV2Pair(poolA).getReserves();
            amount0Out = baseToken == token0
            ? 0
            : getAmountOut(amount, _reserve1, _reserve0, feeNumerator, feeDenominator);
            amount1Out = baseToken == token0
            ? getAmountOut(amount, _reserve0, _reserve1, feeNumerator, feeDenominator)
            : 0;
        }

        IUniswapV2Pair(poolA).swap(amount0Out, amount1Out, address(this), data);
    }

    // initiates swap for V3 pool for any amount of tokens (a.k.a flash-swap),
    // and swaps to V2, sending the borrowed amount back to the pool.
    // see uniswapV3SwapCallback for the next implementation, as pool triggers
    // the callback before checking pool reserve balances
    function arbitrageV3toV2(
        uint amount,
        uint packedFeeAndBaseToken,
        address poolA,
        address poolB
    ) internal {
        address token0 = IUniswapV3Pool(poolA).token0();
        address token1 = IUniswapV3Pool(poolA).token1();
        uint16 feeNumerator = uint16((packedFeeAndBaseToken >> 176) & 0xFFFF);
        uint16 feeDenominator = uint16((packedFeeAndBaseToken >> 160) & 0xFFFF);
        address baseToken = address(uint160(packedFeeAndBaseToken & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF));
        bool zeroForOne = baseToken < (baseToken == token0 ? token1 : token0);
        console.log(uint(feeNumerator));
        console.log(uint(feeDenominator));
        console.log(baseToken);
        console.log(zeroForOne);
        IUniswapV3Pool(poolA).swap(
            address(this),
            zeroForOne,
            amount.toInt256(),
            (
                zeroForOne
                    ? TickMath14.MIN_SQRT_RATIO + 1
                    : TickMath14.MAX_SQRT_RATIO - 1
            ),
            abi.encode(
                FlashV3CallbackData({
                    baseToken: baseToken,
                    pair: poolB,
                    payer: msg.sender,
                    feeNumerator: feeNumerator,
                    feeDenominator: feeDenominator
                })
            )
        );
    }

    function uniswapV2Call(
        address _sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external override {
        IUniswapV2Pair pair = IUniswapV2Pair(msg.sender);
        address token0 = pair.token0();
        address token1 = pair.token1();
        // decoding the encoded data
        FlashV2CallbackData memory decoded = abi.decode(
            data,
            (FlashV2CallbackData)
        );
        // no safety check since different factories can trigger this callback
        /* require(
            msg.sender ==
                IUniswapV2Factory(uniswapV2Router.factory()).getPair(token0, token1),
            "!sender"
        );*/
        // easier to read, so wrote it like that
        // swapping A->B->C
        address tokenB = decoded.baseToken == token0 ? token1 : token0;

        // figuring out if the amountB is in amount1 or amount0
        // as we swap only from one side to the other one of the amounts is always zero
        uint amountB = amount0 == 0 ? amount1 : amount0;
        uint amountC;

        if (decoded.outType == 0) {
            // approving tokenB and swapping tokenB to tokenC(=tokenA)
            TransferHelper.safeApprove(tokenB, decoded.pool, amountB);

            amountC = swapV3Pool(
                decoded.pool,
                amountB,
                address(this),
                0,
                tokenB < decoded.baseToken
            );
        } else if (decoded.outType == 1) {
            TransferHelper.safeApprove(tokenB, decoded.pool, amountB);

            // first we need to transfer then swap
            TransferHelper.safeTransferFrom(tokenB, address(this), decoded.pool, amountB);

            (uint _reserve0, uint _reserve1,) = IUniswapV2Pair(pair).getReserves();
            amountC = getAmountOut(amountB, decoded.baseToken == token0 ? _reserve0 : _reserve1, decoded.baseToken == token0 ? _reserve1 : _reserve0, decoded.feeNumerator, decoded.feeDenominator);
            IUniswapV2Pair(pair).swap(decoded.baseToken == token0 ? amountC : 0, decoded.baseToken == token1 ? amountC : 0, address(this), data);
        }

        // check for the profit, if negative - revert
        require(amountC > decoded.amountA, "!profit");
        // transfering owed tokens back to the v2 pair
        TransferHelper.safeTransfer(decoded.baseToken, address(pair), decoded.amountA);
        // transferring profit!
        TransferHelper.safeTransfer(
            decoded.baseToken,
            decoded.payer,
            amountC - decoded.amountA
        );
    }

    function uniswapV3SwapCallback(
        int amount0Delta,
        int amount1Delta,
        bytes calldata data
    ) external override {
        FlashV3CallbackData memory decoded = abi.decode(
            data,
            (FlashV3CallbackData)
        );
        address token0 = IUniswapV3Pool(msg.sender).token0();
        address token1 = IUniswapV3Pool(msg.sender).token1();
        // making sure the caller is v3 pool
        // edit: no verifies, we use pools directly
        /* CallbackValidation.verifyCallback(
            uniswapV3Router.factory(),
            PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
        );*/

        uint amountA = uint(
            decoded.baseToken == token0 ? amount0Delta : amount1Delta
        );
        uint amountB = uint(
            decoded.baseToken == token0 ? -amount1Delta : -amount0Delta
        );
        console.log(amount0Delta > 0, amountA);
        console.log(amount1Delta > 0, amountB);
        
        // approving the tokenB and swapping amountB to tokenC(=tokenA)
        TransferHelper.safeApprove(
            decoded.baseToken == token0 ? token1 : token0,
            decoded.pair,
            amountB
        );

        TransferHelper.safeTransfer(
            decoded.baseToken == token0 ? token1 : token0,
            decoded.pair,
            amountB
        );

        uint amountC;
        {
            (uint _reserve0, uint _reserve1,) = IUniswapV2Pair(decoded.pair).getReserves();
            uint reserveIn = decoded.baseToken == token0 ? _reserve1 : _reserve0;
            uint reserveOut = decoded.baseToken == token0 ? _reserve0 : _reserve1;
            amountC = getAmountOut(amountB, reserveIn, reserveOut, decoded.feeNumerator, decoded.feeDenominator);
            console.log(amountC);
            IUniswapV2Pair(decoded.pair).swap(decoded.baseToken == token0 ? amountC : 0, decoded.baseToken == token1 ? amountC : 0, address(this), new bytes(0));
        }

        // profit check
        require(amountC > amountA, "!profit");
        TransferHelper.safeApprove(decoded.baseToken, address(this), amountA);

        // return tokens back
        pay(decoded.baseToken, address(this), msg.sender, amountA);

        // return the profit
        uint profit = LowGasSafeMath.sub(amountC, amountA);

        TransferHelper.safeApprove(decoded.baseToken, address(this), profit);
        pay(decoded.baseToken, address(this), decoded.payer, profit);
    }
}
