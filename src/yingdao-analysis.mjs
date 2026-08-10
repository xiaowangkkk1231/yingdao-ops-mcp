function requireDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }
  return value;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function normalizeError(remark) {
  const text = String(remark || "未返回错误说明")
    .replace(/^【[0-9a-f-]{36}】任务失败，?/i, "")
    .trim();
  const marker = text.lastIndexOf("出错：");
  const cause = marker >= 0 ? text.slice(marker + 3).trim() : text;
  return cause
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/\d{10,}/g, "<id>")
    .slice(0, 500);
}

function rankCounts(map, total, limit) {
  return [...map.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percentage: total ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

function parseLocalDateTime(value) {
  const timestamp = Date.parse(`${String(value ?? "").replace(" ", "T")}+08:00`);
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

async function fetchDetails(client, target, signal) {
  const first = await client.getExceptionDetails({
    sceneInstUuid: target.record.uuid,
    robotClientUuid: target.robotClientUuid,
    page: 1,
    size: 100,
    signal,
  });
  const items = [...(first.data ?? [])];
  const pages = first?.page?.pages ?? 1;
  for (let page = 2; page <= pages; page += 1) {
    const next = await client.getExceptionDetails({
      sceneInstUuid: target.record.uuid,
      robotClientUuid: target.robotClientUuid,
      page,
      size: 100,
      signal,
    });
    items.push(...(next.data ?? []));
  }
  return { record: target.record, items };
}

export async function analyzeRecentErrors(
  client,
  {
    startDate,
    endDate,
    maxRecords = 5000,
    concurrency = 10,
    top = 20,
    signal,
  } = {},
) {
  requireDate(startDate, "startDate");
  requireDate(endDate, "endDate");
  if (startDate > endDate) throw new Error("startDate cannot be after endDate");

  const rangeStart = parseLocalDateTime(`${startDate} 00:00:00`);
  const rangeEnd = parseLocalDateTime(`${endDate} 23:59:59`);
  const sceneRecords = [];
  const pageSize = 1000;

  for (let page = 1; ; page += 1) {
    const response = await client.listExecutionRecords({
      page,
      size: pageSize,
      statusList: ["error"],
      signal,
    });
    const records = response.data ?? [];
    sceneRecords.push(...records.filter((record) => parseLocalDateTime(record.createTime) <= rangeEnd));
    if (sceneRecords.length > maxRecords) {
      throw new Error(`The date range contains more than ${maxRecords} abnormal records`);
    }
    const oldest = parseLocalDateTime(records.at(-1)?.createTime);
    // Records are returned newest first. Include the page crossing the start
    // boundary so jobs whose instance was created shortly before the period
    // can still qualify by their own startTime, then stop pagination.
    if (!records.length || page >= response.page.pages || (Number.isFinite(oldest) && oldest < rangeStart)) break;
  }

  const detailTargets = sceneRecords.flatMap((record) =>
    [...new Set((record.executeRobotClientUuidList ?? []).filter(Boolean))].map(
      (robotClientUuid) => ({ record, robotClientUuid }),
    ),
  );
  const detailResults = [];
  const detailFailures = [];
  for (let index = 0; index < detailTargets.length; index += concurrency) {
    const batch = detailTargets.slice(index, index + concurrency);
    const settled = await Promise.allSettled(
      batch.map((target) => fetchDetails(client, target, signal)),
    );
    settled.forEach((result, offset) => {
      if (result.status === "fulfilled") detailResults.push(result.value);
      else {
        detailFailures.push({
          sceneInstUuid: batch[offset].record.uuid,
          error: result.reason instanceof Error ? result.reason.message : "Unknown error",
        });
      }
    });
  }

  // The reporting period is based on the job's actual startTime, not the
  // execution instance createTime used to discover candidate records.
  const errorJobs = detailResults.flatMap(({ record, items }) =>
    items
      .filter((job) => {
        if (job.status !== "error") return false;
        const startedAt = parseLocalDateTime(job.startTime);
        return Number.isFinite(startedAt) && startedAt >= rangeStart && startedAt <= rangeEnd;
      })
      .map((job) => ({ record, job })),
  );
  const byApp = new Map();
  const byRobot = new Map();
  const byError = new Map();
  let durationSeconds = 0;

  for (const { record, job } of errorJobs) {
    increment(byApp, record.sceneName || "未知应用");
    increment(byRobot, record.robotClientShowName || job.robotName || "未知机器人");
    const cause = normalizeError(job.remark);
    const error = byError.get(cause) ?? { count: 0, apps: new Set() };
    error.count += 1;
    error.apps.add(record.sceneName || "未知应用");
    byError.set(cause, error);

    const startedAt = parseLocalDateTime(job.startTime);
    const endedAt = parseLocalDateTime(job.endTime);
    if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt) {
      durationSeconds += (endedAt - startedAt) / 1000;
    }
  }

  return {
    period: { startDate, endDate },
    abnormalExecutionInstances: new Set(errorJobs.map(({ record }) => record.uuid)).size,
    abnormalJobs: errorJobs.length,
    affectedApps: byApp.size,
    affectedRobots: byRobot.size,
    errorTypes: byError.size,
    instancesWithoutRobot: sceneRecords.filter(
      (record) => !(record.executeRobotClientUuidList ?? []).some(Boolean),
    ).length,
    detailRequestFailures: detailFailures.length,
    abnormalDurationHours: Number((durationSeconds / 3600).toFixed(2)),
    topApps: rankCounts(byApp, errorJobs.length, top),
    topRobots: rankCounts(byRobot, errorJobs.length, top),
    topErrors: [...byError.entries()]
      .map(([error, value]) => ({
        error,
        count: value.count,
        percentage: errorJobs.length
          ? Number(((value.count / errorJobs.length) * 100).toFixed(1))
          : 0,
        apps: [...value.apps].slice(0, 5),
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, top),
  };
}
