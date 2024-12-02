import { SearchClient } from "@azure/search-documents";
import { AzureKeyCredential } from "@azure/core-auth";
import { TokenCredential } from "@azure/identity";
import { RTMiddleTier, Tool, ToolResult, ToolResultDirection } from "./rtmt";

const _search_tool_schema = {
  type: "function",
  name: "search",
  description:
    'Search the knowledge base. The knowledge base is in English, translate to and from English if needed. Results are formatted as a source name first in square brackets, followed by the text content, and a line with "-----" at the end of each result.',
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

const _grounding_tool_schema = {
  type: "function",
  name: "report_grounding",
  description:
    "Report use of a source from the knowledge base as part of an answer (effectively, cite the source). Sources appear in square brackets before each knowledge base passage. Always use this tool to cite sources when responding with information from the knowledge base.",
  parameters: {
    type: "object",
    properties: {
      sources: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "List of source names from last statement actually used, do not include the ones not used to formulate a response",
      },
    },
    required: ["sources"],
    additionalProperties: false,
  },
};

const KEY_PATTERN = /^[a-zA-Z0-9_=\-]+$/;

async function _search_tool(
  searchClient: SearchClient<any>,
  semanticConfiguration: string,
  identifierField: string,
  contentField: string,
  embeddingField: string,
  useVectorQuery: boolean,
  args: any
): Promise<ToolResult> {
  console.log(`Searching for '${args.query}' in the knowledge base.`);
  let vectorQueries: any[] = [];
  if (useVectorQuery) {
    vectorQueries = [
      {
        value: args.query,
        kNearestNeighborsCount: 50,
        fields: [embeddingField],
      },
    ];
  }

  const searchOptions: any = {
    queryType: "semantic",
    semanticConfigurationName: semanticConfiguration,
    top: 5,
    select: [identifierField, contentField],
  };

  if (useVectorQuery) {
    searchOptions.vector = vectorQueries[0];
  }
  console.error("Searching... ");
  const results = await searchClient.search(args.query, searchOptions);
  console.warn("Search Complete");
  console.log(`Found results:-  `, results);

  let resultStr = "";
  for await (const result of results.results) {
    const doc = result.document;
    resultStr += `[${doc[identifierField]}]: ${doc[contentField]}\n-----\n`;
  }

  return new ToolResult(resultStr, ToolResultDirection.TO_SERVER);
}

async function _report_grounding_tool(
  searchClient: SearchClient<any>,
  identifierField: string,
  titleField: string,
  contentField: string,
  args: any
): Promise<ToolResult> {
  const sources = args.sources.filter((s: string) => KEY_PATTERN.test(s));
  const list = sources.join(" OR ");
  console.log(`Grounding source: ${list}`);

  const searchOptions: any = {
    searchFields: [identifierField],
    select: [identifierField, titleField, contentField],
    top: sources.length,
    queryType: "full",
  };

  const results = await searchClient.search(list, searchOptions);

  const docs = [];
  for await (const result of results.results) {
    const doc = result.document;
    docs.push({
      chunk_id: doc[identifierField],
      title: doc[titleField],
      chunk: doc[contentField],
    });
  }

  return new ToolResult(
    JSON.stringify({ sources: docs }),
    ToolResultDirection.TO_CLIENT
  );
}

function attachRagTools(
  rtmt: RTMiddleTier,
  credentials: AzureKeyCredential | TokenCredential,
  searchEndpoint: string,
  searchIndex: string,
  semanticConfiguration: string,
  identifierField: string,
  contentField: string,
  embeddingField: string,
  titleField: string,
  useVectorQuery: boolean
): void {
  const searchClient = new SearchClient(
    searchEndpoint,
    searchIndex,
    credentials
  );

  rtmt.tools["search"] = new Tool(
    async (args: any) =>
      await _search_tool(
        searchClient,
        semanticConfiguration,
        identifierField,
        contentField,
        embeddingField,
        useVectorQuery,
        args
      ),
    _search_tool_schema
  );

  rtmt.tools["report_grounding"] = new Tool(
    async (args: any) =>
      await _report_grounding_tool(
        searchClient,
        identifierField,
        titleField,
        contentField,
        args
      ),
    _grounding_tool_schema
  );
}

export { attachRagTools };
