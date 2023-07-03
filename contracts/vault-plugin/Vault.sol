// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "../lib/MultiToken.sol";

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @title Vault
/// @author Libree
/// @notice The vault factory to create vaults from the vault plugin
contract Vault is IERC721Receiver, IERC1155Receiver {
    using MultiToken for MultiToken.Asset;

    /**
     * @dev Emitted when asset transfer happens from an `origin` address to a vault.
     */
    event VaultPull(MultiToken.Asset asset, address indexed origin);

    /**
     * @dev Emitted when asset transfer happens from a vault to a `beneficiary` address.
     */
    event VaultPush(MultiToken.Asset asset, address indexed beneficiary);

    /**
     * @dev Emitted when asset transfer happens from an `origin` address to a `beneficiary` address.
     */
    event VaultPushFrom(
        MultiToken.Asset asset,
        address indexed origin,
        address indexed beneficiary
    );

    mapping(address => bool) private allowedAddreses;

    constructor(address[] memory _allowedAddresses) {
        for (uint256 i = 0; i < _allowedAddresses.length; i++) {
            allowedAddreses[_allowedAddresses[i]] = true;
        }
    }

    function deposit(MultiToken.Asset memory asset, address origin) external {
        uint256 originalBalance = asset.balanceOf(address(this));

        asset.transferAssetFrom(origin, address(this));
        _checkTransfer(asset, originalBalance, address(this));

        emit VaultPull(asset, origin);
    }

    function withdrawn(
        MultiToken.Asset memory asset,
        address beneficiary,
        address sender
    ) external {
        require(allowedAddreses[sender], "not allowed");
        uint256 originalBalance = asset.balanceOf(beneficiary);

        asset.safeTransferAssetFrom(address(this), beneficiary);
        _checkTransfer(asset, originalBalance, beneficiary);

        emit VaultPush(asset, beneficiary);
    }

    function _checkTransfer(
        MultiToken.Asset memory asset,
        uint256 originalBalance,
        address recipient
    ) private view {
        if (
            originalBalance + asset.getTransferAmount() !=
            asset.balanceOf(recipient)
        ) revert("IncompleteTransfer");
    }

    function onERC721Received(
        address operator,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external view override returns (bytes4) {
        if (operator != address(this)) revert("UnsupportedTransferFunction");

        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address operator,
        address /*from*/,
        uint256 /*id*/,
        uint256 /*value*/,
        bytes calldata /*data*/
    ) external view override returns (bytes4) {
        if (operator != address(this)) revert("UnsupportedTransferFunction");

        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address /*operator*/,
        address /*from*/,
        uint256[] calldata /*ids*/,
        uint256[] calldata /*values*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        revert("UnsupportedTransferFunction");
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
