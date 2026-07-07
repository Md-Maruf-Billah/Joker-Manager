export class AppError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.code = code;
  }
}

export function appError(code: string, message: string) {
  return new AppError(code, message);
}

export function errorMessage(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message.startsWith("[") ? error.message : `[${fallbackCode}] ${error.message}`;
  }

  return `[${fallbackCode}] ${fallbackMessage}`;
}

