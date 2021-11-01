/** Base class for errors */
export abstract class SolidityError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

/** Thrown if @TODO: docs */
export class InvalidProgramAccountError extends SolidityError {
    name = 'InvalidProgramAccountError';
}

/** Thrown if @TODO: docs */
export class InvalidStorageAccountError extends SolidityError {
    name = 'InvalidStorageAccountError';
}

/** Thrown if @TODO: docs */
export class MissingPayerAccountError extends SolidityError {
    name = 'MissingPayerAccountError';
}

/** Thrown if @TODO: docs */
export class MissingReturnDataError extends SolidityError {
    name = 'MissingReturnDataError';
}
