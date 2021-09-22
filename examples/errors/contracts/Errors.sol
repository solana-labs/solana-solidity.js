contract Errors {
    function doRevert(bool yes) public pure returns (int256) {
        if (yes) {
            revert('Do the revert thing');
        } else {
            return 3124445;
        }
    }
}
