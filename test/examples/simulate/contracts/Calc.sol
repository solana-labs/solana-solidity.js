contract Calc {
    function add(int256 a, int256 b) public pure returns (int256) {
        return a + b;
    }

    function div(int256 a, int256 b) public pure returns (int256) {
        require(b != 0, 'denominator should not be zero');
        return a / b;
    }
}
