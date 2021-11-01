/** Base class for errors */
export abstract class ContractError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

/** Thrown if @TODO: docs */
export class InvalidProgramAccountError extends ContractError {
    name = 'InvalidProgramAccountError';
}

/** Thrown if @TODO: docs */
export class InvalidStorageAccountError extends ContractError {
    name = 'InvalidStorageAccountError';
}

/** Thrown if @TODO: docs */
export class MissingPayerAccountError extends ContractError {
    name = 'MissingPayerAccountError';
}

/** Thrown if @TODO: docs */
export class MissingReturnDataError extends ContractError {
    name = 'MissingReturnDataError';
}
