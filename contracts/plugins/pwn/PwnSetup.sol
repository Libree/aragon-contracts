// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {Pwn} from "./Pwn.sol";

/// @title PwnSetup
/// @author Libree
/// @notice The setup contract of the `PwnSetup` plugin.
contract PwnSetup is PluginSetup {
    /// @notice The address of `PwnSetup` plugin logic contract to be used in creating proxy contracts.
    Pwn private immutable pwn;

    /// @notice The contract constructor, that deploys the `PwnSetup` plugin logic contract.
    constructor() {
        pwn = new Pwn();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    )
        external
        returns (address plugin, PreparedSetupData memory preparedSetupData)
    {
        (address pwnSimpleLoanOfferAddress, address pwnSimpleLoanAddress) = abi
            .decode(_data, (address, address));

        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(pwn),
            abi.encodeWithSelector(
                Pwn.initialize.selector,
                _dao,
                pwnSimpleLoanOfferAddress,
                pwnSimpleLoanAddress
            )
        );

        // Prepare permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](1);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            pwn.MAKE_OFFER_PERMISSION_ID()
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
        // Prepare permissions
        permissions = new PermissionLib.MultiTargetPermission[](1);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            pwn.MAKE_OFFER_PERMISSION_ID()
        );
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(pwn);
    }
}
