// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {CallExecutor} from "../../CallExecutor.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @title Uniswapv3s
/// @author Libree
/// @notice The Uniswap plugin enables DAOs to manage swap tokens.
contract Uniswapv3 is PluginUUPSUpgradeable, CallExecutor {
    /// @notice The ID of the permission required to call the `withdrawn` function.
    bytes32 public constant SWAP_PERMISSION_ID = keccak256("SWAP_PERMISSION");
    bytes32 public constant PROVIDE_LIQUIDITY_PERMISSION_ID =
        keccak256("PROVIDE_LIQUIDITY_PERMISSION");
    address public uniswapRouterAddress;
    address public nonfungiblePositionManagerAddress;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    /// @notice Initializes the contract.
    /// @param _dao The associated DAO.
    /// @dev This method is required to support [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167).
    function initialize(
        IDAO _dao,
        address _uniswapRouterAddress,
        address _nonfungiblePositionManagerAddress
    ) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        uniswapRouterAddress = _uniswapRouterAddress;
        nonfungiblePositionManagerAddress = _nonfungiblePositionManagerAddress;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external auth(SWAP_PERMISSION_ID) {
        IERC20(tokenIn).transferFrom(address(dao()), address(this), amountIn);
        IERC20(tokenIn).approve(uniswapRouterAddress, amountIn);

        ExactInputSingleParams memory swapParams = ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: recipient,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });

        (bool success, ) = _execute({
            _to: uniswapRouterAddress,
            _value: 0 ether,
            _data: abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))"
                    )
                ),
                swapParams
            )
        });

        if (!success) revert("Error executing the swap");
    }

    function provideLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external auth(PROVIDE_LIQUIDITY_PERMISSION_ID) {
        IERC20(token0).approve(nonfungiblePositionManagerAddress, amount0Desired);
        IERC20(token1).approve(nonfungiblePositionManagerAddress, amount1Desired);

        MintParams memory params = MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(dao()),
            deadline: block.timestamp
        });

        (bool success, ) = _execute({
            _to: nonfungiblePositionManagerAddress,
            _value: 0 ether,
            _data: abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))"
                    )
                ),
                params
            )
        });

        if (!success) revert("Error providing liquidity");
    }
}
