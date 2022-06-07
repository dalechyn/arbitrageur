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
// import "./periphery/PeripheryPayments14.sol";
import "./libraries/TickMath14.sol";

// debugging
import "hardhat/console.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Arbitrageur is
    IUniswapV2Callee,
    IUniswapV3SwapCallback
{
    using LowGasSafeMath for uint;
    using LowGasSafeMath for int;
    using SafeCast for uint;
    using SafeCast for int;

    constructor() {}

    function arbitrage(
        uint blockNumber,
        uint amount,
        address baseToken,
        address poolA,
        address poolB,
        uint8 inType,
        uint8 outType
    ) external {
        require(block.number <= blockNumber, "block");
        if (inType == 0) {
            if (outType == 1) return arbitrageV3toV2(amount, baseToken, poolA, poolB);        
            else revert("NS");
        } else if (inType == 1) return arbitrageV2toAny(amount, baseToken, poolA, poolB, outType);
        else revert("NS");
    }

    // copy from uniswapv2 library with custom fees
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint feeNumerator, uint feeDenominator) internal pure returns (uint amountOut) {
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
        bool zeroForOne,
        bytes memory data
    ) internal returns (uint256 amountOut) {
        (int256 amount0, int256 amount1) =
            IUniswapV3Pool(pool).swap(
                address(this),
                zeroForOne,
                amountIn.toInt256(),
                (zeroForOne ? TickMath14.MIN_SQRT_RATIO + 1 : TickMath14.MAX_SQRT_RATIO - 1),
                data
            );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // initiates swap for V2 pair for any amount of tokens (a.k.a flash-swap),
    // and swaps to V3, sending the borrowed amount back to the pool.
    // see uniswapV2Callback for the next implementation, as pair triggers
    // the callback before checking pair reserve balances
    function arbitrageV2toAny(
        uint amount,
        address baseToken,
        address poolA,
        address poolB, 
        uint8 outType
    ) internal {
        IUniswapV2Pair _poolA = IUniswapV2Pair(poolA);
        address token0 = _poolA.token0();

        // need to pass some data to trigger uniswapV2Call
        bytes memory data = abi.encode(
            FlashV2CallbackData({
                baseToken: baseToken,
                pool: poolB,
                outType: outType,
                // saving the amount of tokens to input (WETH for the current bot implementation)
                // in order to check if the trade was profitable
                amountA: amount/* ,
                feeNumerator: uint16((packedPoolBAndFeeInfo >> 176) & 0xFFFF),
                feeDenominator: uint16((packedPoolBAndFeeInfo >> 160) & 0xFFFF)
 */            })
        );

        uint amount0Out; uint amount1Out;
        { 
            (uint _reserve0, uint _reserve1,) = _poolA.getReserves();
            amount0Out = baseToken == token0
            ? 0
            : getAmountOut(amount, _reserve1, _reserve0, 997, 1000);
            amount1Out = baseToken == token0
            ? getAmountOut(amount, _reserve0, _reserve1, 997, 1000)
            : 0;
        }

        _poolA.swap(amount0Out, amount1Out, address(this), data);
    }

    // initiates swap for V3 pool for any amount of tokens (a.k.a flash-swap),
    // and swaps to V2, sending the borrowed amount back to the pool.
    // see uniswapV3SwapCallback for the next implementation, as pool triggers
    // the callback before checking pool reserve balances
    function arbitrageV3toV2(
        uint amount,
        address baseToken,
        address poolA,
        address poolB
    ) internal {
        IUniswapV3Pool _poolA = IUniswapV3Pool(poolA);
        address token0 = _poolA.token0();
        bool zeroForOne = baseToken < (baseToken == token0 ? _poolA.token1() : token0);
        // console.log(baseToken);
        // console.log(zeroForOne);
        _poolA.swap(
            poolB, // direct transfer, then swap after
            zeroForOne,
            amount.toInt256(),
            (
                zeroForOne
                    ? TickMath14.MIN_SQRT_RATIO + 1
                    : TickMath14.MAX_SQRT_RATIO - 1
            ),
            abi.encode(
                FlashV3CallbackData({
                    swapType: 0,
                    baseToken: baseToken,
                    pair: poolB,
                    payer: msg.sender/* ,
                    feeNumerator: feeNumerator,
                    feeDenominator: feeDenominator */
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
        address tokenB = decoded.baseToken == token0 ? pair.token1() : token0;

        // figuring out if the amountB is in amount1 or amount0
        // as we swap only from one side to the other one of the amounts is always zero
        uint amountB = amount0 == 0 ? amount1 : amount0;
        uint amountC;
        bool sortsBefore = decoded.baseToken == token0;
        if (decoded.outType == 0) {
            // approving tokenB and swapping tokenB to tokenC(=tokenA)
            amountC = swapV3Pool(
                decoded.pool,
                amountB,
                tokenB < decoded.baseToken,
                abi.encode(
                    NoFlashV3CallbackData({
                        swapType: 1,
                        tokenIn: tokenB
                    })
                )
            );
        } else if (decoded.outType == 1) {
            // first we need to transfer then swap
            TransferHelper.safeTransfer(tokenB, decoded.pool, amountB);

            (uint _reserve0, uint _reserve1,) = IUniswapV2Pair(decoded.pool).getReserves();
            // console.log(_reserve0);
            // console.log(_reserve1);
            amountC = getAmountOut(amountB, sortsBefore ? _reserve1 : _reserve0, sortsBefore ? _reserve0 : _reserve1, 997, 1000);
            // console.log(amountC);
            IUniswapV2Pair(decoded.pool).swap(sortsBefore ? amountC : 0, sortsBefore ? 0 : amountC, address(this), new bytes(0));
        }

        // check for the profit, if negative - revert
        require(amountC > decoded.amountA, "!profit");
        // transfering owed tokens back to the v2 pair
        TransferHelper.safeTransfer(decoded.baseToken, msg.sender, decoded.amountA);
        // transferring profit!
        TransferHelper.safeTransfer(
            decoded.baseToken,
            _sender,
            amountC - decoded.amountA
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
            TransferHelper.safeTransfer(decodedNoFlash.tokenIn, msg.sender, amount0Delta > 0
                    ? uint256(amount0Delta)
                    : uint256(amount1Delta));
            return;
        }

        FlashV3CallbackData memory decoded = abi.decode(
            data,
            (FlashV3CallbackData)
        );
        address token0 = IUniswapV3Pool(msg.sender).token0();
        // making sure the caller is v3 pool
        // edit: no verifies, we use pools directly
        /* CallbackValidation.verifyCallback(
            uniswapV3Router.factory(),
            PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
        );*/

        bool sortsBefore = decoded.baseToken == token0;

        uint amountA = uint(
            sortsBefore ? amount0Delta : amount1Delta
        );
        uint amountB = uint(
            sortsBefore ? -amount1Delta : -amount0Delta
        );
        // console.log(amount0Delta > 0, amountA);
        // console.log(amount1Delta > 0, amountB);
        
        uint amountC;
        {
            IUniswapV2Pair pair = IUniswapV2Pair(decoded.pair);
            (uint _reserve0, uint _reserve1,) = pair.getReserves();
            uint reserveIn = sortsBefore ? _reserve1 : _reserve0;
            uint reserveOut = sortsBefore ? _reserve0 : _reserve1;
            amountC = getAmountOut(amountB, reserveIn, reserveOut, 997, 1000);
            // console.log(amountC);
            pair.swap(sortsBefore ? amountC : 0, sortsBefore ? 0 : amountC, address(this), new bytes(0));
        }

        // profit check
        require(amountC > amountA, "!profit");
        // TransferHelper.safeApprove(decoded.baseToken, address(this), amountA);

        // return tokens back
        TransferHelper.safeTransfer(decoded.baseToken, msg.sender, amountA);
        // not gas-friendly, replaced with above
        // pay(decoded.baseToken, address(this), msg.sender, amountA);

        // return the profit
        uint profit = LowGasSafeMath.sub(amountC, amountA);

        // TransferHelper.safeApprove(decoded.baseToken, address(this), profit);
        TransferHelper.safeTransfer(decoded.baseToken, decoded.payer, profit);
        // pay(decoded.baseToken, address(this), decoded.payer, profit);
    }
}
