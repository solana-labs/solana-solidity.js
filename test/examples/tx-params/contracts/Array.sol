contract Array {
    function sum(int256[] memory arr) public pure returns (int256) {
        int256 ret = 0;
        uint256 i = 0;
        for (i = 0; i < arr.length; i++) {
            ret += arr[i];
        }
        return ret;
    }
}
