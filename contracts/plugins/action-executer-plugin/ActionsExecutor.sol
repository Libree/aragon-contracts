// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title ActionsExecutor
/// @author Libree
/// @notice The ActionsExecutor plugin enables DAOs to execute actions attached to proposals
contract ActionsExecutor is PluginUUPSUpgradeable {
    using Counters for Counters.Counter;
    /// @notice The ID of the permission required to call the `registerActions` function.
    bytes32 public constant REGISTER_ACTIONS_PERMISSION_ID =
        keccak256("REGISTER_ACTIONS_PERMISSION");

    struct PendingActions {
        address dao;
        IDAO.Action[] actions;
        uint256 allowFailureMap;
        bool executed;
    }

    mapping(uint256 => PendingActions) public actions;
    uint256 public _lastExecuted;
    Counters.Counter public _currentPending;

    /// @notice Initializes the contract.
    /// @param _dao The associated DAO.
    /// @dev This method is required to support [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167).
    function initialize(IDAO _dao) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
    }

    function registerActions(
        address _dao,
        IDAO.Action[] calldata _actions,
        uint256 _allowFailureMap
    ) external auth(REGISTER_ACTIONS_PERMISSION_ID) {
        uint256 actionsId = _currentPending.current();
        _currentPending.increment();

        PendingActions storage pendingAction = actions[actionsId];
        pendingAction.dao = _dao;
        pendingAction.allowFailureMap = _allowFailureMap;
        pendingAction.executed = false;

        for (uint256 i; i < _actions.length; ) {
            pendingAction.actions.push(_actions[i]);
            unchecked {
                ++i;
            }
        }
    }

    function executeActions(uint256 _actionsId) external {
        PendingActions storage actionsToExecute = actions[_actionsId];
        require(!actionsToExecute.executed, "Already executed");

        for (uint256 i = 0; i < actionsToExecute.actions.length; ) {
            (bool success, bytes memory result) = actionsToExecute.actions[i].to.call{
                value: actionsToExecute.actions[i].value
            }(actionsToExecute.actions[i].data);

            unchecked {
                ++i;
            }
        }

        _lastExecuted = _actionsId;
        actionsToExecute.executed = true;
    }
}
