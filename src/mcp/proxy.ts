import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { JSONSchema7 as IJsonSchema } from "json-schema";
import { Headers } from "node-fetch";
import { OpenAPIV3 } from "openapi-types";
import { HttpClient, HttpClientError } from "../client/http-client";
import { OpenAPIToMCPConverter } from "../openapi/parser";
import { determineBaseUrl } from "../utils/base-url";
import { parseHeadersFromEnv } from "../utils/headers";
import { AccessPolicyConfig, SpaceAccessPolicy } from "./access-policy";

type PathItemObject = OpenAPIV3.PathItemObject & {
  get?: OpenAPIV3.OperationObject;
  put?: OpenAPIV3.OperationObject;
  post?: OpenAPIV3.OperationObject;
  delete?: OpenAPIV3.OperationObject;
  patch?: OpenAPIV3.OperationObject;
};

type NewToolDefinition = {
  methods: Array<{
    name: string;
    description: string;
    inputSchema: IJsonSchema & { type: "object" };
    outputSchema?: IJsonSchema;
  }>;
};

export class MCPProxy {
  private server: Server;
  private httpClient: HttpClient;
  private tools: Record<string, NewToolDefinition>;
  private openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>;
  private accessPolicy: SpaceAccessPolicy;

  constructor(name: string, openApiSpec: OpenAPIV3.Document, accessPolicyConfig: AccessPolicyConfig = {}) {
    this.server = new Server({ name, version: "1.0.0" }, { capabilities: { tools: {} } });
    this.accessPolicy = new SpaceAccessPolicy(accessPolicyConfig);
    const baseUrl = determineBaseUrl(openApiSpec);
    this.httpClient = new HttpClient(
      {
        baseUrl,
        headers: parseHeadersFromEnv(),
      },
      openApiSpec,
    );

    // Convert OpenAPI spec to MCP tools
    const converter = new OpenAPIToMCPConverter(openApiSpec);
    const { tools, openApiLookup } = converter.convertToMCPTools();
    const { filteredTools, filteredLookup } = this.filterRestrictedOperations(tools, openApiLookup);
    this.tools = filteredTools;
    this.openApiLookup = filteredLookup;

    const restrictionDescription = this.accessPolicy.describe();
    if (restrictionDescription) {
      console.error(`Anytype MCP access is ${restrictionDescription}`);
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      // Add methods as separate tools to match the MCP format
      Object.entries(this.tools).forEach(([toolName, def]) => {
        def.methods.forEach((method) => {
          const toolNameWithMethod = `${toolName}-${method.name}`;
          const truncatedToolName = this.truncateToolName(toolNameWithMethod);
          tools.push({
            name: truncatedToolName,
            description: method.description,
            inputSchema: method.inputSchema as Tool["inputSchema"],
          });
        });
      });

      return { tools };
    });

    // Handle tool calling
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error("calling tool", request.params);
      const { name, arguments: params = {} } = request.params;

      // Find the operation in OpenAPI spec
      const operation = this.findOperation(name);
      console.error("operations", this.openApiLookup);
      if (!operation) {
        throw new Error(`Method ${name} not found`);
      }

      try {
        this.accessPolicy.assertRequestAllowed(operation, params);

        // Execute the operation
        const response =
          this.accessPolicy.hasRestrictions() && this.accessPolicy.isListSpacesOperation(operation)
            ? await this.listAllowedSpaces(params)
            : await this.httpClient.executeOperation(operation, params);

        // Convert response to MCP format
        return {
          content: [
            {
              type: "text", // currently this is the only type that seems to be used by mcp server
              text: JSON.stringify(response.data), // TODO: pass through the http status code text?
            },
          ],
        };
      } catch (error) {
        console.error("Error in tool call", error);
        if (error instanceof HttpClientError) {
          console.error("HttpClientError encountered, returning structured error", error);
          const data = error.data?.response?.data ?? error.data ?? {};
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error", // TODO: get this from http status code?
                  ...(typeof data === "object" ? data : { data: data }),
                }),
              },
            ],
          };
        }
        throw error;
      }
    });
  }

  private filterRestrictedOperations(
    tools: Record<string, NewToolDefinition>,
    openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>,
  ): {
    filteredTools: Record<string, NewToolDefinition>;
    filteredLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>;
  } {
    const filteredTools: Record<string, NewToolDefinition> = {};
    const filteredLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }> = {};

    for (const [toolName, definition] of Object.entries(tools)) {
      const methods = definition.methods.filter((method) => {
        const operation = openApiLookup[`${toolName}-${method.name}`];
        return operation ? this.accessPolicy.shouldExposeOperation(operation) : false;
      });

      if (methods.length > 0) {
        filteredTools[toolName] = { methods };
      }
    }

    for (const [toolName, operation] of Object.entries(openApiLookup)) {
      if (this.accessPolicy.shouldExposeOperation(operation)) {
        filteredLookup[toolName] = operation;
      }
    }

    return { filteredTools, filteredLookup };
  }

  private findOperation(operationId: string): (OpenAPIV3.OperationObject & { method: string; path: string }) | null {
    return this.openApiLookup[operationId] ?? null;
  }

  private async listAllowedSpaces(params: Record<string, unknown>): Promise<{ data: unknown; status: number; headers: Headers }> {
    const getSpaceOperation = Object.values(this.openApiLookup).find(
      (operation) => operation.method.toLowerCase() === "get" && operation.path === "/v1/spaces/{space_id}",
    );

    if (!getSpaceOperation) {
      throw new Error("Restricted list-spaces requires the GET /v1/spaces/{space_id} operation to be available.");
    }

    const allowedSpaceIds = this.accessPolicy.getAllowedSpaceIds();
    const offset = this.parsePagingNumber(params.offset, 0);
    const limit = this.parsePagingNumber(params.limit, 100);
    const selectedSpaceIds = allowedSpaceIds.slice(offset, offset + limit);
    const spaces = [];

    for (const spaceId of selectedSpaceIds) {
      const response = await this.httpClient.executeOperation(getSpaceOperation, { space_id: spaceId });
      spaces.push(this.extractSpace(response.data));
    }

    return {
      data: {
        data: spaces,
        pagination: {
          offset,
          limit,
          total: allowedSpaceIds.length,
          has_more: offset + selectedSpaceIds.length < allowedSpaceIds.length,
        },
      },
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
    };
  }

  private extractSpace(data: unknown): unknown {
    if (typeof data === "object" && data !== null && "space" in data) {
      return (data as { space: unknown }).space;
    }

    return data;
  }

  private parsePagingNumber(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return fallback;
  }

  private getContentType(headers: Headers): "text" | "image" | "binary" {
    const contentType = headers.get("content-type");
    if (!contentType) return "binary";

    if (contentType.includes("text") || contentType.includes("json")) {
      return "text";
    } else if (contentType.includes("image")) {
      return "image";
    }
    return "binary";
  }

  private truncateToolName(name: string): string {
    if (name.length <= 64) {
      return name;
    }
    return name.slice(0, 64);
  }

  async connect(transport: Transport) {
    // The SDK will handle stdio communication
    await this.server.connect(transport);
  }
}
