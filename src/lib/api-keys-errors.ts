export class ApiKeyLimitError extends Error {
  constructor() {
    super("API_KEY_LIMIT");
    this.name = "ApiKeyLimitError";
  }
}
