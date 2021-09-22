o?=$(o)

test:
	solang examples/$(o)/contracts/*.sol -o examples/$(o)/build --target solana -v
	mocha -r ts-node/register examples/$(o)/tests/*.spec.ts

solana-test-validator:
	@docker run --rm -it -p 8899:8899 -p 8900:8900 solanalabs/solana:edge > /dev/null

docker-build:
	@docker run --rm -it -v ./:/sources hyperledgerlabs/solang -v -o examples/**/build --target solana examples/**/contracts/*.sol 

.PHONY: test build solana-test-validator docker-build