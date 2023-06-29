// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    uint8 public decimals_ = 18;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 amountToMint
    ) ERC20(name_, symbol_) {
        _mint(msg.sender, amountToMint);
    }

    function setDecimals(uint8 _decimals) public {
        decimals_ = _decimals;
    }

    function decimals() public view override returns (uint8) {
        return decimals_;
    }
}