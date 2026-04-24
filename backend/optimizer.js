import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert SQL performance engineer and database architect with deep knowledge of query optimization across PostgreSQL, MySQL, SQLite, and SQL Server.

When given a SQL query (and optionally a schema), you will:
1. Analyze the query for performance bottlenecks
2. Rewrite it for optimal performance
3. Provide a structured explanation of improvements

Always respond with valid JSON matching this exact schema:
{
  "optimizedQuery": "string",
  "performanceScore": { "before": number, "after": number },
  "improvements": [{ "category": "string", "severity": "string", "title": "string", "description": "string", "before": "string", "after": "string" }],
  "indexSuggestions": [{ "table": "string", "columns": ["string"], "type": "string", "ddl": "string", "reason": "string" }],
  "executionPlan": { "estimated_cost_reduction": "string", "key_operations": ["string"], "warnings": ["string"] },
  "summary": "string"
}`;

export async function optimizeQuery({ query, schema, dialect = "PostgreSQL" }) {
  const userMessage = [
    `**SQL Dialect:** ${dialect}`,
    schema ? `**Database Schema:**\n\`
    `sql\n${schema}\n\`
    `\n` : "*(No schema provided)*",
    `**Query to Optimize:**\n\`
    `sql\n${query}\n\`
    `\n`,
  ].join("\n\n");

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawContent = message.content[0].text;
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
  return JSON.parse(jsonText);
}

export async function* optimizeQueryStream({ query, schema, dialect = "PostgreSQL" }) {
  const userMessage = [
    `**SQL Dialect:** ${dialect}`,
    schema ? `**Database Schema:**\n\`
    `sql\n${schema}\n\`
    `\n` : "*(No schema provided)*",
    `**Query to Optimize:**\n\`
    `sql\n${query}\n\`
    `\n`,
  ].join("\n\n");

  const stream = await client.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let buffer = "";
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      buffer += chunk.delta.text;
      yield { type: "delta", text: chunk.delta.text }; 
    }
  }

  const jsonMatch = buffer.match(/```(?:json)?\s*([\s\S]*?)```/) || buffer.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : buffer.trim();
  yield { type: "complete", data: JSON.parse(jsonText) };
}