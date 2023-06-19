// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {CreditDelegator} from "./CreditDelegator.sol";

contract CreditDelegatorSetup is PluginSetup {
    CreditDelegator private immutable creditDelegator;

    constructor() {
        creditDelegator = new CreditDelegator();
    }

    function prepareInstallation(
        address _dao,
        bytes calldata _data
    )
        external
        returns (address plugin, PreparedSetupData memory preparedSetupData)
    {
        address poolAddress = abi.decode(_data, (address));

        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(creditDelegator),
            abi.encodeWithSelector(
                CreditDelegator.initialize.selector,
                _dao,
                poolAddress
            )
        );

        // Prepare permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](1);

        // Grant `EXECUTE_PERMISSION` on the DAO to the plugin.
        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );

        preparedSetupData.permissions = permissions;
    }

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
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(creditDelegator);
    }
}
