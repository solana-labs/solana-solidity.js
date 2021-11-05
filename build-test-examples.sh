for example in $(shx ls -d test/examples/*/); do\
    shx rm -rf ${example}/build; \
    shx mkdir -p ${example}/build; \
    docker run --rm -it -v $(PWD)/${example}:/example --entrypoint /bin/bash ghcr.io/hyperledger-labs/solang -c "solang /example/contracts/*.sol -o /example/build --target solana -v"; \
done
