// SPDX-License-Identifier: MIT
pragma solidity =0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestCoin is ERC20, Ownable {
    constructor () ERC20("TestCoin", "TST") Ownable() {}

    function mint(uint amount) onlyOwner external {
        _mint(_msgSender(), amount);
    }

    function burn(uint amount) onlyOwner external {
        _burn(_msgSender(), amount);
    }
}
