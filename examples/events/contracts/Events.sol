contract Events {
    event Constructor(int256 indexed a, bool b, string c);

    event First(int256 indexed a, bool b, string c);

    event Second(int256 indexed a, bytes4 b, bytes c);

    constructor() {
        emit Constructor(102, true, 'foobar');
    }

    function first() public {
        emit First(102, true, 'foobar');
    }

    function second() public {
        emit Second(500332, 'ABCD', hex'CAFE0123');
    }
}
