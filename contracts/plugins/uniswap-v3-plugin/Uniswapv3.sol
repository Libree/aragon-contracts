// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "hardhat/console.sol";

/// @title Uniswapv3s
/// @author Libree
/// @notice The Uniswap plugin enables DAOs to manage swap tokens.
contract Uniswapv3 is PluginUUPSUpgradeable {
    /// @notice The ID of the permission required to call the `withdrawn` function.
    bytes32 public constant SWAP_PERMISSION_ID = keccak256("SWAP_PERMISSION");
    address public uniswapRouterAddress;

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

    /// @notice Initializes the contract.
    /// @param _dao The associated DAO.
    /// @dev This method is required to support [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167).
    function initialize(
        IDAO _dao,
        address _uniswapRouterAddress
    ) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        uniswapRouterAddress = _uniswapRouterAddress;
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
        IDAO.Action[] memory actions = new IDAO.Action[](2);

        actions[0] = IDAO.Action({
            to: tokenIn,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(keccak256("approve(address,uint256)")),
                uniswapRouterAddress,
                amountIn
            )
        });

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

        actions[1] = IDAO.Action({
            to: uniswapRouterAddress,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))"
                    )
                ),
                swapParams
            )
        });

        dao().execute({_callId: "", _actions: actions, _allowFailureMap: 0});
    }
}
