import { YingdaoApiClient } from "./yingdao-api.mjs";

function parseInput(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("The command input must be valid JSON");
  }
}

const [command, inputText] = process.argv.slice(2);
const input = parseInput(inputText);
const client = new YingdaoApiClient({
  username: process.env.YINGDAO_USERNAME,
  password: process.env.YINGDAO_PASSWORD,
  basicAuth: process.env.YINGDAO_BASIC_AUTH,
  accessToken: process.env.YINGDAO_ACCESS_TOKEN,
});

let result;
switch (command) {
  case "execution-records":
    result = await client.listExecutionRecords(input);
    break;
  case "exception-details":
    result = await client.getExceptionDetails(input);
    break;
  case "app-statistics":
    result = await client.getAppStatistics(input);
    break;
  case "runtime-total":
    result = await client.getAppStatisticsTotal(input);
    break;
  case "daily-runtime":
    result = await client.getTenantDailyRuntime(input);
    break;
  default:
    throw new Error(
      "Usage: node src/ops-cli.mjs <execution-records|exception-details|app-statistics|runtime-total|daily-runtime> '<json>'",
    );
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
