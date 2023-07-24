// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.8;

abstract contract CallExecutor {
    function _execute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) internal virtual returns (bool success, bytes memory result) {
        return _to.call{value: _value}(_data);
    }
}
