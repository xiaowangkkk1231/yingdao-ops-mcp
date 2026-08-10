import fs from "node:fs";

import { YingdaoApiClient } from "../src/yingdao-api.mjs";
import { YingdaoAuthClient } from "../src/yingdao-auth.mjs";

const [capturePath, startDate, endDate] = process.argv.slice(2);
if (!capturePath || !startDate || !endDate) {
  throw new Error(
    "Usage: node scripts/report-app-statistics.mjs <capture> <startDate> <endDate>",
  );
}

const capture = fs.readFileSync(capturePath, "utf8");
const loginLine = capture
  .split(/\r?\n/)
  .find((line) => line.includes("/oauth/token/v2?username="));
const basicAuth = capture.match(
  /authorization: Basic ([A-Za-z0-9+/=]+)/i,
)?.[1];
if (!loginLine || !basicAuth) {
  throw new Error("The capture does not contain a complete login request");
}

const capturedUrl = new URL(
  loginLine
    .replace(/^curl --url \^"/, "")
    .replace(/\^" \^?$/, "")
    .replaceAll("^", ""),
);
const auth = new YingdaoAuthClient({ basicAuth });
const login = await auth.login({
  username: capturedUrl.searchParams.get("username"),
  encryptedPassword: capturedUrl.searchParams.get("password"),
});
const client = new YingdaoApiClient({ accessToken: login.accessToken });
const firstPage = await client.getAppStatistics({
  page: 1,
  size: 100,
  startStatisticDate: startDate,
  endStatisticDate: endDate,
  sortBy: "3",
});
const responses = [firstPage];
const pageCount = firstPage?.page?.pages ?? 1;
for (let page = 2; page <= pageCount; page += 1) {
  responses.push(
    await client.getAppStatistics({
      page,
      size: 100,
      startStatisticDate: startDate,
      endStatisticDate: endDate,
      sortBy: "3",
    }),
  );
}

const appsById = new Map();
for (const response of responses) {
  for (const app of response.data ?? []) {
    appsById.set(app.appId, app);
  }
}
const allApps = [...appsById.values()];
const activeApps = allApps.filter((app) => Number(app.runCount) > 0);
const totalRunCount = activeApps.reduce(
  (total, app) => total + Number(app.runCount || 0),
  0,
);
const totalRunTime = activeApps.reduce(
  (total, app) => total + Number(app.runTime || 0),
  0,
);
const topByRunCount = activeApps
  .toSorted((left, right) => Number(right.runCount) - Number(left.runCount))
  .slice(0, 10)
  .map(({ appId, appName, ownerName, runCount, runTime }) => ({
    appId,
    appName,
    ownerName,
    runCount: Number(runCount),
    runTime: Number(runTime),
  }));

process.stdout.write(
  `${JSON.stringify(
    {
      period: { startDate, endDate },
      totalApps: allApps.length,
      activeApps: activeApps.length,
      inactiveApps: allApps.length - activeApps.length,
      totalRunCount,
      totalRunTime: Number(totalRunTime.toFixed(2)),
      topByRunCount,
    },
    null,
    2,
  )}\n`,
);
