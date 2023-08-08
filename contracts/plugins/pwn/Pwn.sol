// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {PluginUUPSUpgradeable, IDAO} from "@aragon/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {CallExecutor} from "../../CallExecutor.sol";
import "../../lib/MultiToken.sol";
import "./interfaces/IPWNSimpleLoanListOffer.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @title Pwn
/// @author Libree
/// @notice The credit delegator plugin enables DAOs to deposit their treasury into the Aave protocol and open credit lines.
contract Pwn is PluginUUPSUpgradeable, CallExecutor {
    address public pwnSimpleLoanOfferAddress;
    address public pwnSimpleLoanAddress;

    bytes32 public constant MAKE_OFFER_PERMISSION_ID =
        keccak256("MAKE_OFFER_PERMISSION");

    /// @notice Initializes the contract.
    /// @param _dao The associated DAO.
    /// @dev This method is required to support [ERC-1167](https://eips.ethereum.org/EIPS/eip-1167).
    function initialize(
        IDAO _dao,
        address _pwnSimpleLoanOfferAddress,
        address _pwnSimpleLoanAddress
    ) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        pwnSimpleLoanOfferAddress = _pwnSimpleLoanOfferAddress;
        pwnSimpleLoanAddress = _pwnSimpleLoanAddress;
    }

    function makeOffer(
        IPWNSimpleLoanListOffer.Offer calldata offer
    ) external auth(MAKE_OFFER_PERMISSION_ID) {
        (bool success, ) = _execute({
            _to: pwnSimpleLoanOfferAddress,
            _value: 0 ether,
            _data: abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        "makeOffer((uint8,address,uint256,uint256,address,uint256,uint256,uint32,uint40,address,address,bool,uint256))"
                    )
                ),
                offer
            )
        });
        if (!success) revert("Error making the offer");

        IERC20(offer.loanAssetAddress).approve(
            pwnSimpleLoanAddress,
            offer.loanAmount
        );
    }

    function buyOffer(
        IPWNSimpleLoanListOffer.Offer calldata offer,
        bytes calldata signature
    ) external {
        IPWNSimpleLoanListOffer loanOffer = IPWNSimpleLoanListOffer(
            pwnSimpleLoanOfferAddress
        );

        bytes memory factoryData = loanOffer.encodeLoanTermsFactoryData(offer);

        (bool success, ) = _execute({
            _to: pwnSimpleLoanAddress,
            _value: 0 ether,
            _data: abi.encodeWithSelector(
                bytes4(
                    keccak256("createLOAN(address,bytes,bytes,bytes,bytes)")
                ),
                pwnSimpleLoanOfferAddress,
                factoryData,
                signature,
                bytes(""),
                bytes("")
            )
        });

        if (!success) revert("Error buying the offer");
    }
}
