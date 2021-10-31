contract Test {
    function noop(int256 _a, int256 _b)
        public
        pure
        returns (int256 a, int256 b)
    {
        a = _a;
        b = _b;
    }
}
