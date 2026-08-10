import assert from "node:assert/strict";
import test from "node:test";

import { analyzeRecentErrors } from "../src/yingdao-analysis.mjs";

test("analyzeRecentErrors aggregates applications, robots, errors, and duration", async () => {
  const client = {
    async listExecutionRecords() {
      return {
        data: [
          {
            uuid: "scene-1",
            sceneName: "Application A",
            robotClientShowName: "Robot A",
            executeRobotClientUuidList: ["robot-1"],
            createTime: "2026-08-05 12:00:00",
          },
        ],
        page: { page: 1, pages: 1 },
      };
    },
    async getExceptionDetails() {
      return {
        data: [
          {
            status: "error",
            startTime: "2026-08-05 12:00:00",
            endTime: "2026-08-05 13:30:00",
            remark: "【12345678-1234-1234-1234-123456789012】任务失败，在步骤中出错：KeyError: 'x'",
          },
        ],
        page: { page: 1, pages: 1 },
      };
    },
  };

  const result = await analyzeRecentErrors(client, {
    startDate: "2026-08-01",
    endDate: "2026-08-06",
  });

  assert.equal(result.abnormalJobs, 1);
  assert.equal(result.affectedApps, 1);
  assert.equal(result.affectedRobots, 1);
  assert.equal(result.abnormalDurationHours, 1.5);
  assert.equal(result.topErrors[0].error, "KeyError: 'x'");
});

test("analyzeRecentErrors filters by job startTime instead of instance createTime", async () => {
  const client = {
    async listExecutionRecords() {
      return {
        data: [
          {
            uuid: "scene-before-period",
            sceneName: "Application A",
            robotClientShowName: "Robot A",
            executeRobotClientUuidList: ["robot-1"],
            createTime: "2026-07-31 23:59:00",
          },
        ],
        page: { page: 1, pages: 2 },
      };
    },
    async getExceptionDetails() {
      return {
        data: [
          {
            status: "error",
            startTime: "2026-08-01 00:01:00",
            endTime: "2026-08-01 00:02:00",
            remark: "inside range",
          },
          {
            status: "error",
            startTime: "2026-07-31 23:58:00",
            endTime: "2026-07-31 23:59:00",
            remark: "outside range",
          },
        ],
        page: { page: 1, pages: 1 },
      };
    },
  };

  const result = await analyzeRecentErrors(client, {
    startDate: "2026-08-01",
    endDate: "2026-08-07",
  });

  assert.equal(result.abnormalExecutionInstances, 1);
  assert.equal(result.abnormalJobs, 1);
  assert.equal(result.topErrors[0].error, "inside range");
});
