import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { AzureKeyCredential } from "@azure/core-auth";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

enum ToolResultDirection {
  TO_SERVER = "TO_SERVER",
  TO_CLIENT = "TO_CLIENT",
}

class ToolResult {
  text: string;
  destination: ToolResultDirection;

  constructor(text: string, destination: ToolResultDirection) {
    this.text = text;
    this.destination = destination;
  }

  toText(): string {
    if (this.text == null) return "";
    return typeof this.text === "string"
      ? this.text
      : JSON.stringify(this.text);
  }
}

class Tool {
  target: (args: any) => Promise<ToolResult>;
  schema: any;

  constructor(target: (args: any) => Promise<ToolResult>, schema: any) {
    this.target = target;
    this.schema = schema;
  }
}

class RTToolCall {
  tool_call_id: string;
  previous_id: string;

  constructor(tool_call_id: string, previous_id: string) {
    this.tool_call_id = tool_call_id;
    this.previous_id = previous_id;
  }
}

class RTMiddleTier {
  endpoint: string;
  deployment: string;
  key?: string;
  tools: { [key: string]: Tool } = {};
  model?: string;
  system_message?: string;
  temperature?: number;
  max_tokens?: number;
  disable_audio?: boolean;
  voice_choice?: string;
  api_version: string = "2024-10-01-preview";
  _tools_pending: { [key: string]: RTToolCall } = {};
  _tokenProvider: (() => Promise<string>) | null = null;

  constructor(
    endpoint: string,
    deployment: string,
    credentials: AzureKeyCredential | TokenCredential,
    voice_choice?: string
  ) {
    this.endpoint = endpoint;
    this.deployment = deployment;
    this.voice_choice = voice_choice;
    if (credentials instanceof AzureKeyCredential) {
      this.key = credentials.key;
    } else {
      this._tokenProvider = async () => {
        const token = await credentials.getToken(
          "https://cognitiveservices.azure.com/.default"
        );
        if (!token || !token.token) {
          throw new Error("Failed to retrieve token");
        }
        return token.token;
      };
    }
  }

  private async getToken(): Promise<string> {
    if (this.key) {
      return this.key;
    } else if (this._tokenProvider) {
      return await this._tokenProvider();
    }
    throw new Error("No valid credential available");
  }
  public async processMessageToClient(
    msg: any,
    client_ws: WebSocket,
    server_ws: WebSocket
  ): Promise<void> {
    const message = JSON.parse(msg.toString());
    if (message) {
      switch (message.type) {
        case "session.created":
          const session = message.session;
          session.instructions = "";
          session.tools = [];
          session.voice = this.voice_choice;
          session.tool_choice = "none";
          session.max_response_output_tokens = null;
          client_ws.send(JSON.stringify(message));
          break;

        case "response.output_item.added":
          client_ws.send(JSON.stringify(message));
          break;

        case "conversation.item.created":
          client_ws.send(JSON.stringify(message));
          break;

        case "response.function_call_arguments.delta":
          client_ws.send(JSON.stringify(message));
          break;

        case "response.function_call_arguments.done":
          try {
            const functionCallId = message.response_id;
            const functionName = message.name;
            const functionArgs = JSON.parse(message.arguments);
            const tool = this.tools[functionName];
            console.log("Executing tool:", functionName);
            if (tool) {
              const toolResult = await tool.target(functionArgs);
              if (toolResult.destination === ToolResultDirection.TO_SERVER) {
                server_ws.send(
                  JSON.stringify({
                    type: "conversation.item.created",
                    conversation_item: {
                      message: {
                        text: toolResult.toText(),
                        author: "user",
                      },
                    },
                  })
                );
              } else if (
                toolResult.destination === ToolResultDirection.TO_CLIENT
              ) {
                client_ws.send(toolResult.toText());
              }
            }
          } catch (error) {
            console.error("Error executing tool:", error);
          }
          break;

        case "response.output_item.done":
          client_ws.send(JSON.stringify(message));
          break;

        case "response.done":
          client_ws.send(JSON.stringify(message));
          break;

        default:
          client_ws.send(JSON.stringify(message));
          break;
      }
    }
  }

  public async processMessageToServer(msg: any, ws: WebSocket): Promise<void> {
    const message = JSON.parse(msg.toString());
    if (message) {
      switch (message.type) {
        case "session.update":
          const session = message.session;
          if (this.system_message) {
            session.instructions = this.system_message;
          }
          if (this.temperature != null) {
            session.temperature = this.temperature;
          }
          if (this.max_tokens != null) {
            session.max_response_output_tokens = this.max_tokens;
          }
          if (this.disable_audio != null) {
            session.disable_audio = this.disable_audio;
          }
          if (this.voice_choice) {
            session.voice = this.voice_choice;
          }
          session.tool_choice =
            Object.keys(this.tools).length > 0 ? "auto" : "none";
          session.tools = Object.values(this.tools).map((tool) => tool.schema);
          ws.send(JSON.stringify(message));
          break;

        case "conversation.item.created":
          ws.send(JSON.stringify(message));
          break;

        default:
          ws.send(JSON.stringify(message));
          break;
      }
    }
  }

  public async attachToApp(client_ws: WebSocket): Promise<void> {
    console.warn("Attaching to app");
    const accessToken = await this.getToken();
    const aoaiEndpointOverride = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT;
    const aoaiApiKeyOverride = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const aoaiModelOverride =
      process.env.AZURE_OPENAI_MODEL || "gpt-4o-realtime-preview";
    const azureEndpoint = `${aoaiEndpointOverride}/openai/realtime?api-key=${aoaiApiKeyOverride}&deployment=${aoaiModelOverride}&api-version=2024-10-01-preview`;
    const server_ws = new WebSocket(azureEndpoint);
    // const server_ws = new WebSocket(
    //   `${this.endpoint}/openai/deployments/${this.deployment}/stream?api-version=${this.api_version}`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );

    client_ws.on("message", async (msg) => {
      await this.processMessageToServer(msg, server_ws);
    });

    server_ws.on("message", async (msg) => {
      await this.processMessageToClient(msg, client_ws, server_ws);
    });

    client_ws.on("close", () => {
      console.error("Client disconnected");
      server_ws.close();
    });

    server_ws.on("close", () => {
      console.error("Server disconnected");
      client_ws.close();
    });
  }
}

export { RTMiddleTier, Tool, ToolResult, ToolResultDirection };
