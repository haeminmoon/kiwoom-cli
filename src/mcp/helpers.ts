import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ZodRawShape } from 'zod';
import { KiwoomClient } from '../client/api-client';
import { getEffectiveConfig } from '../config/store';

export function mcpText(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function mcpJson(data: unknown) {
  return mcpText(JSON.stringify(data, null, 2));
}

export function mcpError(message: string) {
  return {
    content: [{ type: 'text' as const, text: `ERROR: ${message}` }],
    isError: true,
  };
}

export function createClient():
  | { client: KiwoomClient }
  | { error: ReturnType<typeof mcpError> } {
  const config = getEffectiveConfig();
  if (!config.appkey || !config.secretkey) {
    return {
      error: mcpError(
        'App key / secret key not configured. Run: kiwoom-cli config init',
      ),
    };
  }
  return {
    client: new KiwoomClient({
      env: config.env,
      appkey: config.appkey,
      secretkey: config.secretkey,
    }),
  };
}

/** Build a client or throw — convenient inside withErrorHandling(). */
export function clientOrThrow(): KiwoomClient {
  const config = getEffectiveConfig();
  if (!config.appkey || !config.secretkey) {
    throw new Error('App key / secret key not configured. Run: kiwoom-cli config init');
  }
  return new KiwoomClient({
    env: config.env,
    appkey: config.appkey,
    secretkey: config.secretkey,
  });
}

/** Current environment ('real' | 'mock'), for order safety checks. */
export function currentEnv(): string {
  return getEffectiveConfig().env;
}

/**
 * Register an MCP tool. Thin wrapper over server.registerTool that fixes the
 * SDK's deep generic inference (zod inputSchema → TS2589) by erasing the
 * shape generic at the call boundary. Runtime validation is unaffected.
 */
export function tool(
  server: McpServer,
  name: string,
  config: { description: string; inputSchema?: ZodRawShape },
  handler: (args: any) => Promise<ReturnType<typeof mcpText> | ReturnType<typeof mcpError>>,
): void {
  (server.registerTool as any)(name, config, handler);
}

export async function withErrorHandling(
  fn: () => Promise<ReturnType<typeof mcpText>>,
): Promise<ReturnType<typeof mcpText> | ReturnType<typeof mcpError>> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return mcpError(message.slice(0, 500));
  }
}
