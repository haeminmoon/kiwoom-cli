/**
 * An error that carries a suggested recovery command, surfaced to the user as
 * a "Try: ..." hint.
 */
export class ActionableError extends Error {
  suggestedCommand?: string;

  constructor(message: string, suggestedCommand?: string) {
    super(message);
    this.name = 'ActionableError';
    this.suggestedCommand = suggestedCommand;
  }
}

/**
 * An error raised when the Kiwoom API returns a non-zero return_code.
 */
export class KiwoomApiError extends Error {
  returnCode: number;
  returnMsg: string;
  apiId?: string;

  constructor(returnCode: number, returnMsg: string, apiId?: string) {
    super(`[${returnCode}] ${returnMsg}`);
    this.name = 'KiwoomApiError';
    this.returnCode = returnCode;
    this.returnMsg = returnMsg;
    this.apiId = apiId;
  }
}

export function handleError(err: unknown): never {
  if (err instanceof ActionableError) {
    console.error(`\nError: ${err.message}`);
    if (err.suggestedCommand) {
      console.error(`\nTry: ${err.suggestedCommand}`);
    }
    process.exit(1);
  }

  if (err instanceof KiwoomApiError) {
    console.error(`\nError: ${err.returnMsg} (code ${err.returnCode})`);
    if (isAuthError(err.returnMsg) || err.returnCode === 3) {
      console.error(`\nTry: kiwoom-cli config init`);
    }
    process.exit(1);
  }

  if (err instanceof Error) {
    let message = err.message;
    if (message.length > 500) {
      message = message.slice(0, 500) + '...';
    }
    if (isAuthError(message)) {
      console.error(`\nError: ${message}`);
      console.error(`\nTry: kiwoom-cli config init`);
      process.exit(1);
    }
    console.error(`\nError: ${message}`);
    process.exit(1);
  }

  console.error(`\nUnknown error:`, err);
  process.exit(1);
}

function isAuthError(message: string): boolean {
  return /unauthorized|forbidden|not authenticated|토큰|인증|appkey|access token|만료/i.test(
    message,
  );
}

export function requireConfig(
  value: string | undefined,
  name: string,
  setCommand: string,
): asserts value is string {
  if (!value) {
    throw new ActionableError(
      `${name} is not configured.`,
      `kiwoom-cli config set ${setCommand}`,
    );
  }
}
