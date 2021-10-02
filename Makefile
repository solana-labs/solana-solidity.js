o?=$(o)
examples=$(shell find examples -type d -maxdepth 1 -mindepth 1)

test-example:
	rm -rf examples/$(o)/build
	mkdir -p examples/$(o)/build
	docker run --rm -it -v $(PWD)/examples/$(o):/example --entrypoint /bin/bash hyperledgerlabs/solang -c "solang /example/contracts/*.sol -o /example/build --target solana -v"
	mocha -r ts-node/register examples/$(o)/tests/*.spec.ts

test-all-examples: $(examples)
	for example in $^; do\
		rm -rf $${example}/build; \
		mkdir -p $${example}/build; \
		docker run --rm -it -v $(PWD)/$${example}:/example --entrypoint /bin/bash hyperledgerlabs/solang -c "solang /example/contracts/*.sol -o /example/build --target solana -v"; \
	done
	mocha -r ts-node/register examples/**/tests/*.spec.ts

test-unit:
	mocha -r ts-node/register tests/unit/*.spec.ts

validator:
	docker pull solanalabs/solana:edge
	docker pull hyperledgerlabs/solang:latest
	docker run --rm -it -p 8899:8899 -p 8900:8900 solanalabs/solana:edge > /dev/null

deploy-docs:
	@$(MAKE) -C docs

publish:
	@npm run prepublish
	@npm run publish

.PHONY: test-example test-all-examples test-unit validator deploy-docs publish