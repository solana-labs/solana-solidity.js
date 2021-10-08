contract Creator {
    Child public c;

    function createChild() public {
        print('Going to create child');
        c = new Child();
        c.sayHello();
    }
}

contract Child {
    constructor() {
        print('In child constructor');
    }

    function sayHello() public pure {
        print('Hello there');
    }
}
