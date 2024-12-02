export async function processMessageToClient(
  msg: any,
  client_ws: WebSocket,
  server_ws: WebSocket,
  voice_choice: string
): Promise<void> {
  const message = JSON.parse(msg.toString());
  if (message) {
    switch (message.type) {
      case "session.created":
        const session = message.session;
        session.instructions = "";
        session.tools = [];
        session.voice = voice_choice;
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
        const functionCallId = message.response_id;
        const functionName = message.function_call_name;
        const functionArgs = JSON.parse(message.function_call_arguments);
        const tool = this.tools[functionName];
        if (tool) {
          try {
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
          } catch (error) {
            console.error("Error executing tool:", error);
          }
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
