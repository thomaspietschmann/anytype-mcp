# Anytype MCP Server

<a href="https://npmjs.org/package/@anyproto/anytype-mcp"><img src="https://img.shields.io/npm/v/@anyproto/anytype-mcp.svg" alt="NPM version" height="20" /></a>
<a href="https://cursor.com/en-US/install-mcp?name=anytype&config=eyJlbnYiOnsiT1BFTkFQSV9NQ1BfSEVBREVSUyI6IntcIkF1dGhvcml6YXRpb25cIjpcIkJlYXJlciA8WU9VUl9BUElfS0VZPlwiLCBcIkFueXR5cGUtVmVyc2lvblwiOlwiMjAyNS0xMS0wOFwifSJ9LCJjb21tYW5kIjoibnB4IC15IEBhbnlwcm90by9hbnl0eXBlLW1jcCJ9"><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add anytype MCP server to Cursor" height="20" /></a>
<a href="https://lmstudio.ai/install-mcp?name=anytype&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBhbnlwcm90by9hbnl0eXBlLW1jcCJdLCJlbnYiOnsiT1BFTkFQSV9NQ1BfSEVBREVSUyI6IntcIkF1dGhvcml6YXRpb25cIjpcIkJlYXJlciA8WU9VUl9BUElfS0VZPlwiLCBcIkFueXR5cGUtVmVyc2lvblwiOlwiMjAyNS0xMS0wOFwifSJ9fQ%3D%3D"><img src="https://files.lmstudio.ai/deeplink/mcp-install-light.svg" alt="Add MCP Server anytype to LM Studio" height="20" /></a>
<a href="https://kiro.dev/launch/mcp/add?name=anytype&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40anyproto%2Fanytype-mcp%22%5D%2C%22env%22%3A%7B%22OPENAPI_MCP_HEADERS%22%3A%22%7B%5C%22Authorization%5C%22%3A%5C%22Bearer%20%3CYOUR_API_KEY%3E%5C%22%2C%20%5C%22Anytype-Version%5C%22%3A%5C%222025-11-08%5C%22%7D%22%7D%7D"><img src="https://kiro.dev/images/add-to-kiro.svg" alt="Add to Kiro" height="20" /></a>

The Anytype MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server enabling AI assistants to seamlessly interact with [Anytype's API](https://github.com/anyproto/anytype-api) through natural language.

It bridges the gap between AI and Anytype's powerful features by converting Anytype's OpenAPI specification into MCP tools, allowing you to manage your knowledge base through conversation.

## Features

- Global & Space Search
- Spaces & Members
- Objects & Lists
- Properties & Tags
- Types & Templates

## Quick Start

### 0. Clone And Install

```bash
git clone <your-fork-url>
cd anytype-mcp
npm install
```

### 1. Get Your API Key

1. Open Anytype
2. Go to App Settings
3. Navigate to API Keys section
4. Click on `Create new` button

<details>
<summary>Alternative: Get API key via CLI</summary>

You can also get your API key using the command line:

```bash
npm start -- get-key
```

</details>

### 1.5. List Space IDs

To discover the space IDs you want to allow, use the built-in bootstrap command:

```bash
ANYTYPE_API_KEY="<YOUR_API_KEY>" \
ANYTYPE_API_VERSION="<ANYTYPE_VERSION>" \
npm start -- list-spaces
```

It prints the accessible Anytype spaces with their `ID`, `TYPE`, and `NAME`. Use the `ID` values with
`--allow-space` or `--allow-channel`.

`OPENAPI_MCP_HEADERS` is still supported for compatibility, but local commands are easier with `ANYTYPE_API_KEY` and
`ANYTYPE_API_VERSION`.

### 2. Configure Your MCP Client

First build the local executable:

```bash
npm run build
```

The build creates [bin/cli.mjs](/Users/tom/ai/anytype-mcp/bin/cli.mjs), which you can point your MCP client at
directly. Use an absolute path in client config.

#### Claude Desktop, Cursor, Windsurf, Raycast, etc.

Add the following configuration to your MCP client settings after replacing `<YOUR_API_KEY>` with your actual API key:

```json
{
  "mcpServers": {
    "anytype": {
      "command": "/absolute/path/to/anytype-mcp/bin/cli.mjs",
      "args": [],
      "env": {
        "ANYTYPE_API_KEY": "<YOUR_API_KEY>",
        "ANYTYPE_API_VERSION": "<ANYTYPE_VERSION>"
      }
    }
  }
}
```

> **Tip:** After creating an API key in Anytype, you can copy that ready-to-use configuration snippet with your API key already filled in from the API Keys section.

#### Claude Code (CLI)

Run this command to add the Anytype MCP server after replacing `<YOUR_API_KEY>` with your actual API key:

```bash
claude mcp add anytype \
  -e ANYTYPE_API_KEY='<YOUR_API_KEY>' \
  -e ANYTYPE_API_VERSION='<ANYTYPE_VERSION>' \
  -s user -- /absolute/path/to/anytype-mcp/bin/cli.mjs
```

<details>
<summary>Compatibility: OPENAPI_MCP_HEADERS</summary>

If you already have an MCP client config that sets `OPENAPI_MCP_HEADERS`, that still works:

```json
{
  "mcpServers": {
    "anytype": {
      "command": "/absolute/path/to/anytype-mcp/bin/cli.mjs",
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <YOUR_API_KEY>\", \"Anytype-Version\":\"2025-11-08\"}"
      }
    }
  }
}
```

</details>

### Restrict MCP Access To Specific Spaces / Channels

If you do not want the MCP server to see your full Anytype vault, start it with one or more `--allow-space` flags.
When this allowlist is active, the server only exposes space-bound tools plus a restricted `list-spaces` view for those
IDs. Global tools like cross-space search and creating new spaces are intentionally hidden.

> Anytype chat channels are spaces with object type `chat`, so `--allow-space` also covers channels. `--allow-channel`
> is available as an alias if you prefer that wording.

```bash
./bin/cli.mjs --allow-space space_abc123 --allow-channel space_def456
```

For MCP clients that use JSON config, add the flags to `args`:

```json
{
  "mcpServers": {
    "anytype": {
      "command": "/absolute/path/to/anytype-mcp/bin/cli.mjs",
      "args": [
        "--allow-space",
        "space_abc123",
        "--allow-space",
        "space_def456"
      ],
      "env": {
        "ANYTYPE_API_KEY": "<YOUR_API_KEY>",
        "ANYTYPE_API_VERSION": "<ANYTYPE_VERSION>"
      }
    }
  }
}
```

### Custom API Base URL

By default, the server connects to `http://127.0.0.1:31009`. For `anytype-cli` (port `31012`) or other custom base URLs, set `ANYTYPE_API_BASE_URL`:

<details>
<summary>Example Configuration</summary>

**MCP Client (Claude Desktop, Cursor, etc.):**
```json
{
  "mcpServers": {
    "anytype": {
      "command": "/absolute/path/to/anytype-mcp/bin/cli.mjs",
      "args": [],
      "env": {
        "ANYTYPE_API_BASE_URL": "http://localhost:31012",
        "ANYTYPE_API_KEY": "<YOUR_API_KEY>",
        "ANYTYPE_API_VERSION": "<ANYTYPE_VERSION>"
      }
    }
  }
}
```

**Claude Code (CLI):**
```bash
claude mcp add anytype \
  -e ANYTYPE_API_BASE_URL='http://localhost:31012' \
  -e ANYTYPE_API_KEY='<YOUR_API_KEY>' \
  -e ANYTYPE_API_VERSION='<ANYTYPE_VERSION>' \
  -s user -- /absolute/path/to/anytype-mcp/bin/cli.mjs
```

</details>

## Example Interactions

Here are some examples of how you can interact with your Anytype:

- "Create a new space called 'Project Ideas' with description 'A space for storing project ideas'"
- "Add a new object of type 'Task' with title 'Research AI trends' to the 'Project Ideas' space"
- "Create a second one with title 'Dive deep into LLMs' with due date in 3 days and assign it to me"
- "Now create a collection with the title "Tasks for this week" and add the two tasks to that list. Set due date of the first one to 10 days from now"

## Development

### Local Commands

Run one-off commands from the repo root:

```bash
npm start -- get-key
npm start -- list-spaces
npm start -- --allow-space space_abc123
```

When you want to use the built executable directly:

```bash
npm run build
./bin/cli.mjs list-spaces
./bin/cli.mjs --allow-space space_abc123
```

## Contribution

Thank you for your desire to develop Anytype together!

❤️ This project and everyone involved in it is governed by the [Code of Conduct](https://github.com/anyproto/.github/blob/main/docs/CODE_OF_CONDUCT.md).

🧑‍💻 Check out our [contributing guide](https://github.com/anyproto/.github/blob/main/docs/CONTRIBUTING.md) to learn about asking questions, creating issues, or submitting pull requests.

🫢 For security findings, please email [security@anytype.io](mailto:security@anytype.io) and refer to our [security guide](https://github.com/anyproto/.github/blob/main/docs/SECURITY.md) for more information.

🤝 Follow us on [Github](https://github.com/anyproto) and join the [Contributors Community](https://github.com/orgs/anyproto/discussions).

---

Made by Any — a Swiss association 🇨🇭

Licensed under [MIT](./LICENSE.md).
