contract Events {
    event First(int256 indexed a, bool b, string c);

    event Second(int256 indexed a, bytes4 b, bytes c);

    function first() public {
        emit First(102, true, 'foobar');
    }

    function second() public {
        emit Second(500332, 'ABCD', hex'CAFE0123');
    }
}
