// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {VaultManager} from "./VaultManager.sol";

/// @title VaultSetup
/// @author Libree
/// @notice The setup contract of the `Vault` plugin.
contract VaultManagerSetup is PluginSetup {
    /// @notice The address of `Vault` plugin logic contract to be used in creating proxy contracts.
    VaultManager private immutable vaultManager;

    /// @notice The contract constructor, that deploys the `VaultSetup` plugin logic contract.
    constructor() {
        vaultManager = new VaultManager();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    )
        external
        returns (address plugin, PreparedSetupData memory preparedSetupData)
    {
        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(vaultManager),
            abi.encodeWithSelector(VaultManager.initialize.selector, _dao)
        );
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    )
        external
        view
        returns (PermissionLib.MultiTargetPermission[] memory permissions)
    {}

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(vaultManager);
    }
}
