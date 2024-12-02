import { NextResponse } from "next/server";
import { SearchClient } from "@azure/search-documents";
import { AzureKeyCredential } from "@azure/core-auth";

export async function GET() {
  try {
    const searchKey = process.env.AZURE_SEARCH_API_KEY!;
    const searchCredential = new AzureKeyCredential(searchKey);
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT!;
    const searchIndex = process.env.AZURE_SEARCH_INDEX!;
    const searchClient = new SearchClient(
      searchEndpoint,
      searchIndex,
      searchCredential
    );
    const results = await searchClient.search("c", {
      queryType: "full",
    });
    const searchResults = [];
    for await (const result of results.results) {
      searchResults.push(result);
    }
    return NextResponse.json(searchResults);
  } catch (error) {
    return NextResponse.json(error);
  }
}
