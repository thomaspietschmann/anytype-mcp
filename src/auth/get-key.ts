import axios from "axios";
import path from "node:path";
import * as readline from "readline";

interface AuthToken {
  api_key: string;
}

export type AnytypeCredentials = {
  apiKey: string;
  anytypeVersion: string;
};

export function displayCredentialsInstructions({ apiKey, anytypeVersion }: AnytypeCredentials): void {
  const localCliPath = path.resolve(process.cwd(), "bin/cli.mjs");
  const localTsxPath = path.resolve(process.cwd(), "node_modules/.bin/tsx");
  const localSourcePath = path.resolve(process.cwd(), "scripts/start-server.ts");
  console.log(`\nYour API KEY: ${apiKey}`);
  console.log("\nFor local commands in this repo root, export:");
  console.log(`export ANYTYPE_API_KEY="${apiKey}"`);
  console.log(`export ANYTYPE_API_VERSION="${anytypeVersion}"`);
  console.log("\nThen you can discover space IDs with:");
  console.log(`${localTsxPath} ${localSourcePath} list-spaces --login --configure`);
  console.log("\nAfter `npm run build`, you can add this to your MCP settings file as:");
  console.log(`
{
  "mcpServers": {
    "anytype": {
      "command": "${localCliPath}",
      "env": {
        "ANYTYPE_API_KEY": "${apiKey}",
        "ANYTYPE_API_VERSION": "${anytypeVersion}"
      }
    }
  }
}
`);
}

export class ApiKeyGenerator {
  private readonly rl: readline.Interface;
  private readonly appName: string = "anytype_mcp_server";
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private prompt(question: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * Start the authentication process with Anytype
   * @returns Challenge ID to use with completeAuthentication
   */
  private async startAuthentication(): Promise<string> {
    try {
      const response = await axios.post(`${this.basePath}/v1/auth/challenges`, { app_name: this.appName });

      if (!response.data?.challenge_id) {
        throw new Error("Failed to get challenge ID");
      }

      return response.data.challenge_id;
    } catch (error) {
      console.error("Authentication error:", error instanceof Error ? error.message : error);
      throw new Error("Failed to start authentication", { cause: error });
    }
  }

  /**
   * Complete the authentication process using the challenge ID and display code
   * @param challengeId Challenge ID from startAuthentication
   * @param code Display code shown in Anytype desktop
   * @returns Authentication tokens
   */
  private async completeAuthentication(
    challengeId: string,
    code: string,
  ): Promise<AnytypeCredentials> {
    try {
      const response = await axios.post<AuthToken>(`${this.basePath}/v1/auth/api_keys`, {
        challenge_id: challengeId,
        code: code,
      });

      if (!response.data?.api_key) {
        throw new Error("Authentication failed: No api key received");
      }

      return { apiKey: response.data.api_key, anytypeVersion: response.headers["anytype-version"] };
    } catch (error) {
      console.error("Authentication error:", error instanceof Error ? error.message : error);
      throw new Error("Failed to complete authentication", { cause: error });
    }
  }

  public async authenticate(): Promise<AnytypeCredentials> {
    try {
      console.log("Starting authentication to get API key...");

      const challengeId = await this.startAuthentication();
      console.log("Please check Anytype Desktop for the 4-digit code");
      const code = await this.prompt("Enter the 4-digit code shown in Anytype Desktop: ");

      return await this.completeAuthentication(challengeId, code);
    } finally {
      this.rl.close();
    }
  }

  public async generateApiKey(): Promise<void> {
    try {
      const credentials = await this.authenticate();
      console.log("Authenticated successfully!");
      displayCredentialsInstructions(credentials);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}
