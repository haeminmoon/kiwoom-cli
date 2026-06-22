import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerMarketTools } from './mcp/tools/market';
import { registerChartTools } from './mcp/tools/chart';
import { registerAccountTools } from './mcp/tools/account';
import { registerOrderTools } from './mcp/tools/order';
import { registerRankingTools } from './mcp/tools/ranking';

const server = new McpServer({
  name: 'kiwoom-mcp',
  version: '0.1.0',
});

registerMarketTools(server);
registerChartTools(server);
registerAccountTools(server);
registerOrderTools(server);
registerRankingTools(server);

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
