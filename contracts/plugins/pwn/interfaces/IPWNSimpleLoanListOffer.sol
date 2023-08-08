// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

import "../../../lib/MultiToken.sol";

interface IPWNSimpleLoanListOffer {
    struct Offer {
        MultiToken.Category collateralCategory;
        address collateralAddress;
        uint256 collateralId;
        uint256 collateralAmount;
        address loanAssetAddress;
        uint256 loanAmount;
        uint256 loanYield;
        uint32 duration;
        uint40 expiration;
        address borrower;
        address lender;
        bool isPersistent;
        uint256 nonce;
    }

    struct OfferValues {
        uint256 collateralId;
        bytes32[] merkleInclusionProof;
    }

    function getOfferHash(Offer memory offer) external view returns (bytes32);

    function encodeLoanTermsFactoryData(
        Offer memory offer
    ) external pure returns (bytes memory);
}
