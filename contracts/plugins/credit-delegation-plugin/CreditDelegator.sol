// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {ICreditDelegationToken} from "@aave/core-v3/contracts/interfaces/ICreditDelegationToken.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import {CallExecutor} from "../../CallExecutor.sol";

/// @title CreditDelegator
/// @author Libree
/// @notice The credit delegator plugin enables DAOs to deposit their treasury into the Aave protocol and open credit lines.
contract CreditDelegator is PluginUUPSUpgradeable, CallExecutor {
    address public poolAddress;

    /// @notice The ID of the permission required to call the `withdrawn` function.
    bytes32 public constant WITHDRAWN_AAVE_PERMISSION_ID =
        keccak256("WITHDRAWN_AAVE_PERMISSION");

    /// @notice The ID of the permission required to call the `approveDelegation` function.
    bytes32 public constant APPROVE_DELEGATION_PERMISSION_ID =
        keccak256("APPROVE_DELEGATION_PERMISSION");

    /// @notice The ID of the permission required to call the `approveDelegation` function.
    bytes32 public constant BORROW_AAVE_PERMISSION_ID =
        keccak256("BORROW_AAVE_PERMISSION");

    /// @notice The ID of the permission required to call the `borrowAndTransfer` function.
    bytes32 public constant BORROW_AND_TRANSFER_AAVE_PERMISSION_ID =
        keccak256("BORROW_AND_TRANSFER_AAVE_PERMISSION");

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
    function initialize(IDAO _dao, address _poolAddress) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        poolAddress = _poolAddress;
    }

    /// @notice Supplies a specified amount of an asset to the Aave pool and send it to the treasury.
    /// @param _asset The address of the asset to be supplied.
    /// @param _amount The amount of the asset to be supplied.
    function supply(address _asset, uint256 _amount) external {
        IERC20(_asset).approve(poolAddress, _amount);
        IERC20(_asset).transferFrom(msg.sender, address(this), _amount);
        IPool(poolAddress).supply(_asset, _amount, address(this), 0);
        address aTokenAddress = IPool(poolAddress)
            .getReserveData(_asset)
            .aTokenAddress;

        uint256 atokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
        IERC20(aTokenAddress).approve(address(dao()), atokenBalance);

        dao().deposit(aTokenAddress, atokenBalance, "");
    }

    /// @notice Withdraws a specified amount of an asset from the treasury
    /// @param _asset The address of the asset to be withdrawn.
    /// @param _amount The amount of the asset to be withdrawn.
    /// @param _to The address where the withdrawn assets will be sent.
    function withdrawn(
        address _asset,
        uint256 _amount,
        address _to
    ) external auth(WITHDRAWN_AAVE_PERMISSION_ID) {
        IDAO.Action[] memory actions = new IDAO.Action[](1);

        actions[0] = IDAO.Action({
            to: poolAddress,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(keccak256("withdraw(address,uint256,address)")),
                _asset,
                _amount,
                _to
            )
        });

        dao().execute({_callId: "", _actions: actions, _allowFailureMap: 0});
    }

    /// @notice Approves delegation of a specified amount of an asset to a delegatee.
    /// @param _asset The address of the asset for which delegation is being approved.
    /// @param _delegatee The address of the delegatee who will be granted delegation rights.
    /// @param _amount The amount of the asset to be approved for delegation.
    function approveDelegation(
        address _asset,
        address _delegatee,
        uint256 _amount
    ) external auth(APPROVE_DELEGATION_PERMISSION_ID) {
        IDAO.Action[] memory actions = new IDAO.Action[](1);

        actions[0] = IDAO.Action({
            to: _asset,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(keccak256("approveDelegation(address,uint256)")),
                _delegatee,
                _amount
            )
        });

        dao().execute({_callId: "", _actions: actions, _allowFailureMap: 0});
    }

    /// @notice Borrows from aave pool
    /// @param _asset The address of the asset to borrow
    /// @param _amount The asset amount to borrow
    /// @param _interestRateMode Interest rate mode
    /// @param _referralCode Referral code
    /// @param _onBehalfOf If borrowing on behalf of another account
    function borrow(
        address _asset,
        uint256 _amount,
        uint256 _interestRateMode,
        uint16 _referralCode,
        address _onBehalfOf
    ) external auth(BORROW_AAVE_PERMISSION_ID) {
        IDAO.Action[] memory actions = new IDAO.Action[](1);

        actions[0] = IDAO.Action({
            to: poolAddress,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(
                    keccak256("borrow(address,uint256,uint256,uint16,address)")
                ),
                _asset,
                _amount,
                _interestRateMode,
                _referralCode,
                _onBehalfOf
            )
        });

        dao().execute({_callId: "", _actions: actions, _allowFailureMap: 0});
    }

    /// @notice Borrows from aave pool and transfer to beneficiary
    /// @param _asset The address of the asset to borrow
    /// @param _amount The asset amount to borrow
    /// @param _interestRateMode Interest rate mode
    /// @param _referralCode Referral code
    /// @param _onBehalfOf If borrowing on behalf of another account
    function borrowAndTransfer(
        address _asset,
        uint256 _amount,
        uint256 _interestRateMode,
        uint16 _referralCode,
        address _onBehalfOf,
        address _beneficiary
    ) public auth(BORROW_AND_TRANSFER_AAVE_PERMISSION_ID) {
        IDAO.Action[] memory actions = new IDAO.Action[](2);

        actions[0] = IDAO.Action({
            to: poolAddress,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(
                    keccak256("borrow(address,uint256,uint256,uint16,address)")
                ),
                _asset,
                _amount,
                _interestRateMode,
                _referralCode,
                _onBehalfOf
            )
        });

        actions[1] = IDAO.Action({
            to: _asset,
            value: 0 ether,
            data: abi.encodeWithSelector(
                bytes4(keccak256("transfer(address,uint256)")),
                _beneficiary,
                _amount
            )
        });

        dao().execute({_callId: "", _actions: actions, _allowFailureMap: 0});
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
            (bool success, ) = _execute({
                _to: actionsToExecute.actions[i].to,
                _value: actionsToExecute.actions[i].value,
                _data: actionsToExecute.actions[i].data
            });

            if (!success) revert("Error executing action");

            unchecked {
                ++i;
            }
        }

        _lastExecuted = _actionsId;
        actionsToExecute.executed = true;
    }
}
