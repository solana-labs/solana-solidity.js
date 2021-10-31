integrations=$(shell find tests/integration -maxdepth 1 -mindepth 1 -type d)

test:
	@$(MAKE) test-unit
	@$(MAKE) test-integrations

test-integrations: $(integrations)
	for integration in $^; do\
		rm -rf $${integration}/build; \
		mkdir -p $${integration}/build; \
		docker run --rm -it -v $(PWD)/$${integration}:/integration --entrypoint /bin/bash ghcr.io/hyperledger-labs/solang -c "solang /integration/contracts/*.sol -o /integration/build --target solana -v"; \
	done
	./node_modules/.bin/mocha -r ts-node/register tests/integration/**/tests/*.spec.ts

test-integration:
	@if [ ! -d "tests/integration/$(o)" ]; then \
		echo "integration($o) doesn't exist"; \
		exit -1; \
  fi
	rm -rf tests/integration/$(o)/build
	mkdir -p tests/integration/$(o)/build
	docker run --rm -it -v $(PWD)/tests/integration/$(o):/integration --entrypoint /bin/bash ghcr.io/hyperledger-labs/solang -c "solang /integration/contracts/*.sol -o /integration/build --target solana -v"
	./node_modules/.bin/mocha -r ts-node/register tests/integration/$(o)/tests/*.spec.ts

test-unit:
	./node_modules/.bin/mocha -r ts-node/register tests/unit/*.spec.ts

validator:
	docker pull solanalabs/solana:edge
	docker pull ghcr.io/hyperledger-labs/solang:latest
	docker run --rm -it -p 8899:8899 -p 8900:8900 solanalabs/solana:edge > /dev/null

deploy-docs:
	@$(MAKE) -C docs

publish:
	@npm run publish

.PHONY: test test-integrations test-integration test-unit validator deploy-docs publish