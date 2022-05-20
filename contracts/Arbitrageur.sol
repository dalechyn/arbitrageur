// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;

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
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/SafeCast.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/base/PeripheryPayments.sol";

// Callback data
import "./library/UniswapCallbackData.sol";

// debugging
import "hardhat/console.sol";

contract Arbitrageur is
    IUniswapV2Callee,
    IUniswapV3SwapCallback,
    PeripheryPayments
{
    using LowGasSafeMath for uint;
    using LowGasSafeMath for int;
    using SafeCast for uint;
    using SafeCast for int;

    ISwapRouterExtended immutable routerV3;
    IUniswapV2Router02 immutable routerV2;

    constructor(ISwapRouterExtended _routerV3, IUniswapV2Router02 _routerV2)
        PeripheryImmutableState(_routerV3.factory(), _routerV3.WETH9())
    {
        routerV3 = _routerV3;
        routerV2 = _routerV2;
    }

    // initiates swap for V2 pair for any amount of tokens (a.k.a flash-swap),
    // and swaps to V3, sending the borrowed amount back to the pool.
    // see uniswapV2Callback for the next implementation, as pair triggers
    // the callback before checking pair reserve balances
    function arbitrageV2toV3(
        uint amount,
        address baseToken,
        address pair,
        address pool
    ) external {
        require(pair != address(0), "!pair");

        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();

        // need to pass some data to trigger uniswapV2Call
        bytes memory data = abi.encode(
            FlashV2CallbackData({
                baseToken: baseToken,
                pool: pool,
                payer: msg.sender,
                // saving the amount of tokens to input (WETH for the current bot implementation)
                // in order to check if the trade was profitable
                amountA: amount
            })
        );

        // prepare path in order to get the output amounts
        // needed for calling the swap
        address[] memory path = new address[](2);
        path[0] = baseToken;
        path[1] = baseToken == token0 ? token1 : token0;

        // correct ordering
        uint amount0Out = baseToken == token0
            ? 0
            : routerV2.getAmountsOut(amount, path)[1];
        uint amount1Out = baseToken == token0
            ? routerV2.getAmountsOut(amount, path)[1]
            : 0;

        console.log(amount0Out);
        console.log(amount1Out);
        IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
    }

    // initiates swap for V3 pool for any amount of tokens (a.k.a flash-swap),
    // and swaps to V2, sending the borrowed amount back to the pool.
    // see uniswapV3SwapCallback for the next implementation, as pool triggers
    // the callback before checking pool reserve balances
    function arbitrageV3toV2(
        uint amount,
        address baseToken,
        address pair,
        address pool
    ) external {
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();
        bool zeroForOne = baseToken < (baseToken == token0 ? token1 : token0);
        IUniswapV3Pool(pool).swap(
            address(this),
            zeroForOne,
            amount.toInt256(),
            (
                zeroForOne
                    ? TickMath.MIN_SQRT_RATIO + 1
                    : TickMath.MAX_SQRT_RATIO - 1
            ),
            abi.encode(
                FlashV3CallbackData({
                    baseToken: baseToken,
                    pair: pair,
                    payer: msg.sender
                })
            )
        );
    }

    // as of now calling UniV2-UniV3 is kinda ~ hardcoded
    // will need to put more info in the data like dex-index or somthng like this
    // and again - as of now, this callback will execute v3 trade, and v3 callback -> v2 trade
    function uniswapV2Call(
        address sender,
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
        // safety check so the method cannot be called by other EOA/contract except the pair itself
        require(
            msg.sender ==
                IUniswapV2Factory(routerV2.factory()).getPair(token0, token1),
            "!sender"
        );
        // easier to read, so wrote it like that
        // swapping A->B->C
        address tokenA = decoded.baseToken;
        address tokenB = decoded.baseToken == token0 ? token1 : token0;
        address tokenC = tokenA;

        // figuring out if the amountB is in amount1 or amount0
        // as we swap only from one side to the other one of the amounts is always zero
        uint amountB = amount0 == 0 ? amount1 : amount0;
        uint amountC;

        // approving tokenB and swapping tokenB to tokenC(=tokenA)
        TransferHelper.safeApprove(tokenB, address(routerV3), amountB);

        amountC = routerV3.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenB,
                tokenOut: tokenC,
                fee: IUniswapV3Pool(decoded.pool).fee(),
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountB,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        // check for the profit, if negative - revert
        require(amountC > decoded.amountA, "!profit");
        // transfering owed tokens back to the v2 pair
        TransferHelper.safeTransfer(tokenA, address(pair), decoded.amountA);
        // transferring profit!
        TransferHelper.safeTransfer(
            tokenA,
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
        uint24 fee = IUniswapV3Pool(msg.sender).fee();
        // making sure the caller is v3 pool
        CallbackValidation.verifyCallback(
            routerV3.factory(),
            PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
        );

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
            address(routerV2),
            amountB
        );

        uint amountC;
        {
            address[] memory path = new address[](2);
            path[0] = decoded.baseToken == token0 ? token1 : token0;
            path[1] = decoded.baseToken == token0 ? token0 : token1;
            amountC = routerV2.swapExactTokensForTokens(
                amountB,
                0,
                path,
                address(this),
                block.timestamp
            )[1];
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
