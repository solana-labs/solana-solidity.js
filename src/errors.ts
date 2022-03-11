/** Base class for contract errors */
export abstract class ContractError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

/** Thrown if transaction simulation fails */
export class SimulationError extends ContractError {
    logs: string[];
    computeUnitsUsed: number;
    constructor(message?: string) {
        super(message);
        this.logs = [];
        this.computeUnitsUsed = 0;
    }
}

/** Thrown if the program ID provided doesn't match the contract */
export class InvalidProgramAccountError extends ContractError {
    name = 'InvalidProgramAccountError';
}

/** Thrown if the storage account provided doesn't match the contract */
export class InvalidStorageAccountError extends ContractError {
    name = 'InvalidStorageAccountError';
}

/** Thrown if a payer account wasn't provided */
export class MissingPayerAccountError extends ContractError {
    name = 'MissingPayerAccountError';
}

/** Thrown if a contract function expects return values and didn't receive them */
export class MissingReturnDataError extends ContractError {
    name = 'MissingReturnDataError';
}
