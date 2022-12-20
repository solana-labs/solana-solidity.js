contract Creator {
    Child public c;

    function createChild(address _child) public {
        print('creating child');
        c = new Child{address: _child}();
    }

    function updateChild(uint8 _value) public {
        print('updating child');
        c.updateValue(_value);
    }

    function readChild() public view returns (uint8) {
        print('reading child');
        return c.readValue();
    }
}

@program_id("92AaiNTBJmM583bhjaF7g67XEHiKbPZiZY9DoUrjX6cj")
contract Child {
    uint8 value;

    constructor() {
        print('initializing child');
        value = 0;
    }

    function updateValue(uint8 _value) public {
        print('updating child value');
        value = _value;
    }

    function readValue() public view returns (uint8) {
        print('reading child value');
        return value;
    }
}
