import { ApiKeyGenerator } from "../src/auth/get-key";
import { formatCliHelp, parseCliArgs } from "../src/cli/args";
import { listSpaces } from "../src/cli/list-spaces";
import { initProxy, loadOpenApiSpec, ValidationError } from "../src/init-server";
import { determineBaseUrl } from "../src/utils/base-url";

async function generateApiKey(specPath?: string) {
  const openApiSpec = await loadOpenApiSpec(specPath);
  const baseUrl = determineBaseUrl(openApiSpec);
  const generator = new ApiKeyGenerator(baseUrl);
  await generator.generateApiKey();
}

export async function main(args: string[] = process.argv.slice(2)) {
  const parsedArgs = parseCliArgs(args);

  if (parsedArgs.showHelp) {
    console.log(formatCliHelp());
    return;
  }

  if (parsedArgs.command === "run") {
    await initProxy(parsedArgs.specPath, parsedArgs.accessPolicy);
  } else if (parsedArgs.command === "get-key") {
    await generateApiKey(parsedArgs.specPath);
  } else if (parsedArgs.command === "list-spaces") {
    await listSpaces(parsedArgs.specPath);
  }
}

main().catch((error) => {
  if (error instanceof ValidationError) {
    console.error("Invalid OpenAPI 3.1 specification:");
    error.errors.forEach((err) => console.error(err));
  } else {
    console.error("Error:", error.message);
  }
  process.exit(1);
});
