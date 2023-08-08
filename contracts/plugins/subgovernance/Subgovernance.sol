// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {RATIO_BASE, _applyRatioCeiled} from "@aragon/osx/plugins/utils/Ratio.sol";
import {IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";

import {IMajorityVoting} from "@aragon/osx/plugins/governance/majority-voting/IMajorityVoting.sol";
import {MajorityVotingBase} from "@aragon/osx/plugins/governance/majority-voting/MajorityVotingBase.sol";
import {GroupVotingList} from "./GroupVotingList.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title GroupVoting
/// @notice The majority voting implementation using groups of members
/// @dev This contract inherits from `MajorityVotingBase` and implements the `IMajorityVoting` interface.
contract Subgovernance is MajorityVotingBase {
    using SafeCastUpgradeable for uint256;
    using Counters for Counters.Counter;

    /// @notice The [ERC-165](https://eips.ethereum.org/EIPS/eip-165) interface ID of the contract.
    bytes4 internal constant GROUPLIST_VOTING_INTERFACE_ID = this.initialize.selector;

    /// @notice The ID of the permission required to call the `addAddresses` and `removeAddresses` functions.
    bytes32 public constant UPDATE_ADDRESSES_PERMISSION_ID =
        keccak256("UPDATE_ADDRESSES_PERMISSION");

    bytes32 public constant CREATE_GROUP_PERMISSION_ID =
        keccak256("CREATE_GROUP_PERMISSION");

    Counters.Counter public _groupIdCounter;
    mapping(uint256 => string) public groupsNames;
    mapping(uint256 => GroupVotingList) public groups;
    mapping(uint256 => uint256) public proposalGroup;

    /// @notice Emitted when members are added to the group.
    /// @param members The list of new members being added.
    event MembersAdded(address[] members, uint256 groupId);

    /// @notice Emitted when members are removed from the group.
    /// @param members The list of existing members being removed.
    event MembersRemoved(address[] members, uint256 groupId);

    /// @notice Initializes the component.
    /// @dev This method is required to support [ERC-1822](https://eips.ethereum.org/EIPS/eip-1822).
    /// @param _dao The IDAO interface of the associated DAO.
    /// @param _votingSettings The voting settings.
    function initialize(
        IDAO _dao,
        VotingSettings calldata _votingSettings
    ) external initializer {
        __MajorityVotingBase_init(_dao, _votingSettings);
    }

    function createGroup(
        string calldata _groupName,
        address[] calldata _members
    ) external auth(CREATE_GROUP_PERMISSION_ID) {
        uint256 groupId = _groupIdCounter.current();
        _groupIdCounter.increment();

        GroupVotingList group = new GroupVotingList();
        group.addAddresses(_members);

        groupsNames[groupId] = _groupName;
        groups[groupId] = group;
    }

    /// @notice Adds new members to the address list.
    /// @param _members The addresses of members to be added.
    /// @dev This function is used during the plugin initialization.
    function addAddresses(
        address[] calldata _members,
        uint256 _groupId
    ) external auth(UPDATE_ADDRESSES_PERMISSION_ID) {
        groups[_groupId].addAddresses(_members);

        emit MembersAdded(_members, _groupId);
    }

    /// @notice Removes existing members from the address list.
    /// @param _members The addresses of the members to be removed.
    function removeAddresses(
        address[] calldata _members,
        uint256 _groupId
    ) external auth(UPDATE_ADDRESSES_PERMISSION_ID) {
        groups[_groupId].removeAddresses(_members);

        emit MembersRemoved(_members, _groupId);
    }

    /// @inheritdoc MajorityVotingBase
    function totalVotingPower(
        uint256 _blockNumber
    ) public view override returns (uint256) {
        revert("Not implemented");
    }

    function totalVotingPower(
        uint256 _blockNumber,
        uint256 _groupId
    ) public view returns (uint256) {
        return groups[_groupId].addresslistLengthAtBlock(_blockNumber);
    }

    function isListedAtBlock(
        address _account,
        uint256 _groupId,
        uint256 _blockNumber
    ) public view virtual returns (bool) {
        return groups[_groupId].isListedAtBlock(_account, _blockNumber);
    }

    /// @inheritdoc MajorityVotingBase
    function createProposal(
        bytes calldata _metadata,
        IDAO.Action[] calldata _actions,
        uint256 _allowFailureMap,
        uint64 _startDate,
        uint64 _endDate,
        VoteOption _voteOption,
        bool _tryEarlyExecution
    ) external override returns (uint256 proposalId) {
        revert("Not implemented");
    }

    function createProposal(
        bytes calldata _metadata,
        IDAO.Action[] calldata _actions,
        uint256 _allowFailureMap,
        uint64 _startDate,
        uint64 _endDate,
        VoteOption _voteOption,
        bool _tryEarlyExecution,
        uint256 _groupId
    ) external returns (uint256 proposalId) {
        uint64 snapshotBlock;
        unchecked {
            snapshotBlock = block.number.toUint64() - 1;
        }

        if (
            minProposerVotingPower() != 0 &&
            !groups[_groupId].isListedAtBlock(_msgSender(), snapshotBlock)
        ) {
            revert ProposalCreationForbidden(_msgSender());
        }

        proposalId = _createProposal({
            _creator: _msgSender(),
            _metadata: _metadata,
            _startDate: _startDate,
            _endDate: _endDate,
            _actions: _actions,
            _allowFailureMap: _allowFailureMap
        });

        // Store proposal related information
        Proposal storage proposal_ = proposals[proposalId];

        proposalGroup[proposalId] = _groupId;

        (
            proposal_.parameters.startDate,
            proposal_.parameters.endDate
        ) = _validateProposalDates({_start: _startDate, _end: _endDate});
        proposal_.parameters.snapshotBlock = snapshotBlock;
        proposal_.parameters.votingMode = votingMode();
        proposal_.parameters.supportThreshold = supportThreshold();
        proposal_.parameters.minVotingPower = _applyRatioCeiled(
            totalVotingPower(snapshotBlock, _groupId),
            minParticipation()
        );

        // Reduce costs
        if (_allowFailureMap != 0) {
            proposal_.allowFailureMap = _allowFailureMap;
        }

        for (uint256 i; i < _actions.length; ) {
            proposal_.actions.push(_actions[i]);
            unchecked {
                ++i;
            }
        }

        if (_voteOption != VoteOption.None) {
            vote(proposalId, _voteOption, _tryEarlyExecution);
        }
    }

    function isMember(
        address _account,
        uint256 _groupId
    ) public view returns (bool) {
        return groups[_groupId].isListed(_account);
    }

    /// @inheritdoc MajorityVotingBase
    function _vote(
        uint256 _proposalId,
        VoteOption _voteOption,
        address _voter,
        bool _tryEarlyExecution
    ) internal override {
        Proposal storage proposal_ = proposals[_proposalId];

        VoteOption state = proposal_.voters[_voter];

        // Remove the previous vote.
        if (state == VoteOption.Yes) {
            proposal_.tally.yes = proposal_.tally.yes - 1;
        } else if (state == VoteOption.No) {
            proposal_.tally.no = proposal_.tally.no - 1;
        } else if (state == VoteOption.Abstain) {
            proposal_.tally.abstain = proposal_.tally.abstain - 1;
        }

        // Store the updated/new vote for the voter.
        if (_voteOption == VoteOption.Yes) {
            proposal_.tally.yes = proposal_.tally.yes + 1;
        } else if (_voteOption == VoteOption.No) {
            proposal_.tally.no = proposal_.tally.no + 1;
        } else if (_voteOption == VoteOption.Abstain) {
            proposal_.tally.abstain = proposal_.tally.abstain + 1;
        }

        proposal_.voters[_voter] = _voteOption;

        emit VoteCast({
            proposalId: _proposalId,
            voter: _voter,
            voteOption: _voteOption,
            votingPower: 1
        });

        if (_tryEarlyExecution && _canExecute(_proposalId)) {
            _execute(_proposalId);
        }
    }

    /// @inheritdoc MajorityVotingBase
    function _canVote(
        uint256 _proposalId,
        address _account,
        VoteOption _voteOption
    ) internal view override returns (bool) {
        Proposal storage proposal_ = proposals[_proposalId];

        uint256 group = proposalGroup[_proposalId];

        if (!isMember(_account, group)) {
            return false;
        }

        // The proposal vote hasn't started or has already ended.
        if (!_isProposalOpen(proposal_)) {
            return false;
        }

        // The voter votes `None` which is not allowed.
        if (_voteOption == VoteOption.None) {
            return false;
        }

        // The voter has no voting power.
        if (
            !groups[proposalGroup[_proposalId]].isListedAtBlock(
                _account,
                proposal_.parameters.snapshotBlock
            )
        ) {
            return false;
        }

        // The voter has already voted but vote replacement is not allowed.
        if (
            proposal_.voters[_account] != VoteOption.None &&
            proposal_.parameters.votingMode != VotingMode.VoteReplacement
        ) {
            return false;
        }

        return true;
    }

    function getGroupName(
        uint256 _groupId
    ) public view returns (string memory name) {
        name = groupsNames[_groupId];
    }

    /// @dev This empty reserved space is put in place to allow future versions to add new
    /// variables without shifting down storage in the inheritance chain.
    /// https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[50] private __gap;
}
