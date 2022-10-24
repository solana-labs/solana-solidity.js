for example in $(shx ls -d test/examples/*/); do\
    shx rm -rf ${example}/build; \
    shx mkdir -p ${example}/build; \
    docker run --rm -t -v $PWD/${example}:/example --entrypoint /bin/bash ghcr.io/hyperledger/solang -c "solang compile /example/contracts/*.sol -o /example/build --target solana -v"; \
done
