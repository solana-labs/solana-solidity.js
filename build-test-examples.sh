examples=$(find test/examples -maxdepth 1 -mindepth 1 -type d)

for example in $examples; do\
    rm -rf ${example}/build; \
    mkdir -p ${example}/build; \
    docker run --rm -it -v $(PWD)/${example}:/example --entrypoint /bin/bash ghcr.io/hyperledger-labs/solang -c "solang /example/contracts/*.sol -o /example/build --target solana -v"; \
done
