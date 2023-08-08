// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {MajorityVotingBase} from "@aragon/osx/plugins/governance/majority-voting/MajorityVotingBase.sol";
import {Subgovernance} from "./Subgovernance.sol";

/// @title SubgovernanceSetup
/// @author Libree
/// @notice The setup contract of the `Subgovernance` plugin.
contract SubgovernanceSetup is PluginSetup {
    /// @notice The address of `Subgovernance` plugin logic contract to be used in creating proxy contracts.
    Subgovernance private immutable subgovernance;

    /// @notice The contract constructor, that deploys the `SubgovernanceSetup` plugin logic contract.
    constructor() {
        subgovernance = new Subgovernance();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    )
        external
        returns (address plugin, PreparedSetupData memory preparedSetupData)
    {
        MajorityVotingBase.VotingSettings memory votingSettings = abi.decode(
            _data,
            (MajorityVotingBase.VotingSettings)
        );

        // Prepare and Deploy the plugin proxy.
        plugin = createERC1967Proxy(
            address(subgovernance),
            abi.encodeWithSelector(
                Subgovernance.initialize.selector,
                _dao,
                votingSettings
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
            subgovernance.UPDATE_ADDRESSES_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            subgovernance.CREATE_GROUP_PERMISSION_ID()
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
        permissions = new PermissionLib.MultiTargetPermission[](2);

        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            subgovernance.UPDATE_ADDRESSES_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            subgovernance.CREATE_GROUP_PERMISSION_ID()
        );
    }

    /// @inheritdoc IPluginSetup
    function implementation() external view returns (address) {
        return address(subgovernance);
    }
}
