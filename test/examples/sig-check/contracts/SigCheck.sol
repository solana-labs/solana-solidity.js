contract SigCheck {
	function verify(address addr, bytes message, bytes signature) public pure returns (bool) {
		return signatureVerify(addr, message, signature);
	}
}
