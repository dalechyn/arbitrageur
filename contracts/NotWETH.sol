// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NotWETH is ERC20, Ownable {
    constructor () ERC20("NotWETH", "nWETH") Ownable() {
        _mint(_msgSender(), 1e30);
    }

    function mint(uint amount) onlyOwner external {
        _mint(_msgSender(), amount);
    }

    function burn(uint amount) onlyOwner external {
        _burn(_msgSender(), amount);
    }
}
