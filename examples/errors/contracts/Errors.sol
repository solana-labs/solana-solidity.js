contract Errors {
    function doRevert(bool yes) public pure returns (int256) {
        if (yes) {
            revert('Do the revert thing');
        } else {
            return 3124445;
        }
    }

    function doRequire(bool yes) public pure returns (int256) {
        require(!yes, 'Do the require thing');
        return 3124445;
    }

    function doAssert(bool yes) public pure returns (int256) {
        assert(!yes);
        return 3124445;
    }
}
