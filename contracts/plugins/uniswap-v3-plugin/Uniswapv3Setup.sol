// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {Uniswapv3} from "./Uniswapv3.sol";

/// @title Uniswapv3Setup
/// @author Libree
/// @notice The setup contract of the `Uniswapv3` plugin.
contract Uniswapv3Setup is PluginSetup {
    /// @notice The address of `Uniswapv3` plugin logic contract to be used in creating proxy contracts.
    Uniswapv3 private immutable uniswapv3;

    /// @notice The contract constructor, that deploys the `Uniswapv3Setup` plugin logic contract.
    constructor() {
        uniswapv3 = new Uniswapv3();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    )
        external
        returns (address plugin, PreparedSetupData memory preparedSetupData)
    {
        (
            address uniswapRouterAddress,
            address nonfungiblePositionManagerAddress
        ) = abi.decode(_data, (address, address));

        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(uniswapv3),
            abi.encodeWithSelector(
                Uniswapv3.initialize.selector,
                _dao,
                uniswapRouterAddress,
                nonfungiblePositionManagerAddress
            )
        );

        // Prepare permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](2);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            uniswapv3.SWAP_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            uniswapv3.PROVIDE_LIQUIDITY_PERMISSION_ID()
        );

        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    )
        external
        view
        returns (PermissionLib.MultiTargetPermission[] memory permissions)
    {
        permissions = new PermissionLib.MultiTargetPermission[](2);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            uniswapv3.SWAP_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            uniswapv3.PROVIDE_LIQUIDITY_PERMISSION_ID()
        );
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(uniswapv3);
    }
}
