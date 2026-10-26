import { BadRequestException, ValidationError } from '@nestjs/common';

export interface ValidationFieldError {
  readonly field: string;
  readonly message: string;
}

function flattenValidationErrors(
  errors: ReadonlyArray<ValidationError>,
  parentPath = '',
): ValidationFieldError[] {
  const result: ValidationFieldError[] = [];

  for (const error of errors) {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push({ field: fieldPath, message });
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, fieldPath));
    }
  }

  return result;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const formattedErrors = flattenValidationErrors(errors);
  return new BadRequestException({
    message: 'Los datos enviados no cumplen las reglas de validación.',
    errors: formattedErrors,
  });
}
