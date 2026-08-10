import assert from "node:assert/strict";
import test from "node:test";

import { YingdaoApiClient } from "../src/yingdao-api.mjs";

function createClient(payload = { code: 200, data: [] }) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/api/noauth/requestCredential/get")) {
      return new Response(JSON.stringify({ data: { credential: "nonce" } }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return {
    calls,
    client: new YingdaoApiClient({ accessToken: "token", fetchImpl }),
  };
}

test("listExecutionRecords sends the expected POST body and credential", async () => {
  const { client, calls } = createClient();

  await client.listExecutionRecords({ statusList: ["failed"] });

  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/api\/dispatch\/v3\/scene\/inst\/page$/);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.authorization, "Bearer token");
  assert.equal(calls[1].options.headers["x-credential"], "nonce");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    page: 1,
    size: 10,
    isLast: false,
    scheduleUuidList: [],
    statusList: ["failed"],
  });
});

test("getExceptionDetails sends a GET without requesting a credential", async () => {
  const { client, calls } = createClient();

  await client.getExceptionDetails({
    sceneInstUuid: "scene-id",
    robotClientUuid: "client-id",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/dispatch/v2/scene/inst/job/list");
  assert.equal(url.searchParams.get("sceneInstUuid"), "scene-id");
  assert.equal(url.searchParams.get("robotClientUuid"), "client-id");
});

test("getAppStatistics validates dates and sends the expected body", async () => {
  const { client, calls } = createClient();

  await client.getAppStatistics({
    startStatisticDate: "2026-07-05",
    endStatisticDate: "2026-08-05",
  });

  assert.deepEqual(JSON.parse(calls[1].options.body), {
    page: 1,
    size: 100,
    startStatisticDate: "2026-07-05",
    endStatisticDate: "2026-08-05",
    sortBy: "3",
  });
  await assert.rejects(
    () =>
      client.getAppStatistics({
        startStatisticDate: "2026-08-06",
        endStatisticDate: "2026-08-05",
      }),
    /cannot be after/,
  );
});

test("runtime summary endpoints send the HAR-discovered request bodies", async () => {
  const { client, calls } = createClient({ data: { totalRunCount: 7, totalRunTime: "12.34" } });

  await client.getAppStatisticsTotal({
    startStatisticDate: "2026-07-30",
    endStatisticDate: "2026-08-05",
  });
  await client.getTenantDailyRuntime({ days: 7 });

  assert.equal(calls.length, 4);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    page: 1,
    size: 100,
    startStatisticDate: "2026-07-30",
    endStatisticDate: "2026-08-05",
  });
  assert.deepEqual(JSON.parse(calls[3].options.body), { days: 7 });
});
