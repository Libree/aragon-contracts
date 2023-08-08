// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

interface IPWNSimpleLoan {
    function createLOAN(
        address loanTermsFactoryContract,
        bytes calldata loanTermsFactoryData,
        bytes calldata signature,
        bytes calldata loanAssetPermit,
        bytes calldata collateralPermit
    ) external returns (uint256 loanId);
}
