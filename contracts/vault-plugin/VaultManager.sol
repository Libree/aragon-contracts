// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "../lib/MultiToken.sol";

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Vault} from "./Vault.sol";

/// @title Vault
/// @author Libree
/// @notice The vault plugin enables DAOs to manage assets in an isolated vault.
contract VaultManager is PluginUUPSUpgradeable {
    using MultiToken for MultiToken.Asset;

    /// @notice The ID of the permission required to call the `withdrawn` function.
    bytes32 public constant VAULT_WITHDRAWN_PERMISSION_ID =
        keccak256("VAULT_WITHDRAWN_PERMISSION");

    /// @notice The ID of the permission required to call the `createVault` function.
    bytes32 public constant VAULT_CREATE_PERMISSION_ID =
        keccak256("VAULT_CREATE_PERMISSION");

    mapping(string => Vault) private vaults;

    /// @notice Initializes the contract.
    /// @param _dao The associated DAO.
    /// @dev This method is required to support [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167).
    function initialize(IDAO _dao) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
    }

    function createVault(
        string memory name,
        address[] memory allowedAdresses
    ) external auth(VAULT_CREATE_PERMISSION_ID) {
        Vault vault = new Vault(allowedAdresses);
        vaults[name] = vault;
    }

    function deposit(
        MultiToken.Asset memory asset,
        address origin,
        string memory vaultName
    ) external {
        vaults[vaultName].deposit(asset, origin);
    }

    function withdrawn(
        MultiToken.Asset memory asset,
        address beneficiary,
        string memory vaultName
    ) external auth(VAULT_WITHDRAWN_PERMISSION_ID) {
        vaults[vaultName].withdrawn(asset, beneficiary, msg.sender);
    }

    function getVault(string memory name) public view returns (Vault) {
        return vaults[name];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
