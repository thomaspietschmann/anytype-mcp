import { OpenAPIV3 } from "openapi-types";

export type AccessControlledOperation = OpenAPIV3.OperationObject & { method: string; path: string };

export type AccessPolicyConfig = {
  allowedSpaceIds?: string[];
};

export class SpaceAccessPolicy {
  private readonly allowedSpaceIds: string[];
  private readonly allowedSpaceIdSet: Set<string>;

  constructor(config: AccessPolicyConfig = {}) {
    this.allowedSpaceIds = normalizeSpaceIds(config.allowedSpaceIds);
    this.allowedSpaceIdSet = new Set(this.allowedSpaceIds);
  }

  hasRestrictions(): boolean {
    return this.allowedSpaceIds.length > 0;
  }

  getAllowedSpaceIds(): string[] {
    return [...this.allowedSpaceIds];
  }

  describe(): string | null {
    if (!this.hasRestrictions()) {
      return null;
    }

    return `restricted to ${this.allowedSpaceIds.length} allowed space(s): ${this.allowedSpaceIds.join(", ")}`;
  }

  shouldExposeOperation(operation: AccessControlledOperation): boolean {
    if (!this.hasRestrictions()) {
      return true;
    }

    return this.isListSpacesOperation(operation) || this.isSpaceScopedOperation(operation);
  }

  assertRequestAllowed(operation: AccessControlledOperation, params: Record<string, unknown>): void {
    if (!this.hasRestrictions()) {
      return;
    }

    if (this.isListSpacesOperation(operation)) {
      return;
    }

    if (!this.shouldExposeOperation(operation)) {
      throw new Error(
        `Tool ${operation.operationId ?? operation.path} is disabled because this Anytype MCP server is ${this.describe()}.`,
      );
    }

    if (!this.isSpaceScopedOperation(operation)) {
      return;
    }

    const requestedSpaceId = params.space_id;
    if (typeof requestedSpaceId !== "string" || requestedSpaceId.trim().length === 0) {
      throw new Error(
        `Tool ${operation.operationId ?? operation.path} requires a space_id because this Anytype MCP server is ${this.describe()}.`,
      );
    }

    if (!this.allowedSpaceIdSet.has(requestedSpaceId)) {
      throw new Error(
        `Access to Anytype space "${requestedSpaceId}" is not allowed. Restart the MCP server with --allow-space ${requestedSpaceId} to permit it.`,
      );
    }
  }

  isListSpacesOperation(operation: AccessControlledOperation): boolean {
    return operation.method.toLowerCase() === "get" && operation.path === "/v1/spaces";
  }

  isSpaceScopedOperation(operation: AccessControlledOperation): boolean {
    return operation.path.includes("{space_id}");
  }
}

function normalizeSpaceIds(spaceIds: string[] | undefined): string[] {
  if (!spaceIds) {
    return [];
  }

  const normalized = new Set<string>();
  for (const entry of spaceIds) {
    for (const value of entry.split(",")) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        normalized.add(trimmed);
      }
    }
  }

  return [...normalized];
}
