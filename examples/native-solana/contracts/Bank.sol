contract Bank {
    mapping(address => uint256) private balances;

    // function deposit() public payable returns (uint256 newBalance) {
    //     balances[msg.sender] += msg.value;
    //     newBalance = balances[msg.sender];
    // }

    // function withdraw(uint64 withdrawAmount)
    //     public
    //     returns (uint256 newBalance)
    // {
    //     require(withdrawAmount <= balances[msg.sender]);
    //     balances[msg.sender] -= withdrawAmount;
    //     payable(msg.sender).transfer(withdrawAmount);
    //     newBalance = balances[msg.sender];
    // }
}
