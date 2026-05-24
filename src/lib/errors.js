export class RegionError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'RegionError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function toHttpError(error) {
  if (error instanceof RegionError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        details: error.details
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      error: 'Unexpected REGION service error',
      details: { message: error.message }
    }
  };
}
