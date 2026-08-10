import fs from "node:fs";

const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: node scripts/inspect-har.mjs <file.har>");

const har = JSON.parse(fs.readFileSync(filePath, "utf8"));
const relevant = har.log.entries.filter(({ request }) => {
  const url = request.url;
  return /api\.yingdao\.com/.test(url) && /(dispatch|scene|inst|job|record|statistic|monitor)/i.test(url);
});

function jsonValue(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function shape(value) {
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, firstItemKeys: value[0] && Object.keys(value[0]) };
  }
  if (value && typeof value === "object") {
    return { type: "object", keys: Object.keys(value) };
  }
  return { type: typeof value };
}

for (const entry of relevant) {
  const url = new URL(entry.request.url);
  const body = jsonValue(entry.request.postData?.text);
  const response = jsonValue(entry.response.content?.text);
  const responseData = response?.data;
  console.log(JSON.stringify({
    method: entry.request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    requestBodyKeys: body && typeof body === "object" ? Object.keys(body) : undefined,
    requestBody: body,
    status: entry.response.status,
    responseKeys: response && typeof response === "object" ? Object.keys(response) : undefined,
    responseDataShape: shape(responseData),
    responseDataSampleKeys: Array.isArray(responseData) ? responseData.slice(0, 3).map((item) => Object.keys(item)) : undefined,
  }));
}
