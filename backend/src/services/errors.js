export class AppError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(messages) {
    super(Array.isArray(messages) ? messages.join(" ") : messages, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.details = Array.isArray(messages) ? messages : [messages];
  }
}

export class ConflictError extends AppError {
  constructor(message = "Os dados mudaram em outro dispositivo. Recarregue antes de salvar novamente.") {
    super(message, 409, "REVISION_CONFLICT");
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Faça login para continuar.") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}
