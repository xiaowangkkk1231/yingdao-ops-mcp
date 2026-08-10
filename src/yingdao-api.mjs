import {
  YingdaoAuthClient,
  YingdaoAuthError,
  readYingdaoJson,
} from "./yingdao-auth.mjs";

const DEFAULT_BASE_URL = "https://api.yingdao.com";

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new YingdaoAuthError(`${name} is required`);
  }
  return value.trim();
}

function positiveInteger(value, name, maximum = 1000) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new YingdaoAuthError(`${name} must be an integer from 1 to ${maximum}`);
  }
  return value;
}

function stringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new YingdaoAuthError(`${name} must be an array of strings`);
  }
  return value;
}

function isoDate(value, name) {
  requireString(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new YingdaoAuthError(`${name} must use YYYY-MM-DD format`);
  }
  return value;
}

export class YingdaoApiClient {
  constructor({
    username,
    password,
    encryptedPassword,
    basicAuth,
    accessToken,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new YingdaoAuthError("A Fetch API implementation is required");
    }
    if (!accessToken && (!username || (!password && !encryptedPassword) || !basicAuth)) {
      throw new YingdaoAuthError(
        "Provide accessToken or username, password/encryptedPassword, and basicAuth",
      );
    }

    this.username = username;
    this.password = password;
    this.encryptedPassword = encryptedPassword;
    this.accessToken = accessToken;
    this.tokenExpiresAt = accessToken ? Number.POSITIVE_INFINITY : 0;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
    this.authClient = basicAuth
      ? new YingdaoAuthClient({ basicAuth, baseUrl: this.baseUrl, fetchImpl })
      : null;
  }

  commonHeaders() {
    return {
      accept: "application/json",
      "accept-language": "zh-CN",
      "content-type": "application/json",
      origin: "https://console.yingdao.com",
      referer: "https://console.yingdao.com/",
      timezone: encodeURIComponent("+08:00"),
      "x-from": "console",
    };
  }

  async ensureAccessToken({ signal } = {}) {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    if (!this.authClient) {
      throw new YingdaoAuthError("The access token has expired and login credentials are unavailable");
    }

    const login = await this.authClient.login({
      username: this.username,
      password: this.password,
      encryptedPassword: this.encryptedPassword,
      signal,
    });
    this.accessToken = login.accessToken;
    const expiresIn = Number(login.expiresIn);
    this.tokenExpiresAt = Number.isFinite(expiresIn)
      ? Date.now() + Math.max(0, expiresIn - 60) * 1000
      : Number.POSITIVE_INFINITY;
    return this.accessToken;
  }

  async request(path, { method = "GET", query, body, signal, operation = "API request" } = {}) {
    const accessToken = await this.ensureAccessToken({ signal });
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      ...this.commonHeaders(),
      authorization: `Bearer ${accessToken}`,
    };
    if (method !== "GET") {
      const credentialClient = this.authClient;
      if (credentialClient) {
        headers["x-credential"] = await credentialClient.getRequestCredential({ signal });
      } else {
        const credentialResponse = await this.fetch(
          `${this.baseUrl}/api/noauth/requestCredential/get`,
          { method: "GET", headers: this.commonHeaders(), signal },
        );
        const credentialPayload = await readYingdaoJson(
          credentialResponse,
          "Request credential",
        );
        headers["x-credential"] = credentialPayload?.data?.credential;
        if (!headers["x-credential"]) {
          throw new YingdaoAuthError("Request credential is missing from response");
        }
      }
    }

    const response = await this.fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    return readYingdaoJson(response, operation);
  }

  async listExecutionRecords({
    page = 1,
    size = 10,
    isLast = false,
    scheduleUuidList = [],
    statusList = [],
    signal,
  } = {}) {
    positiveInteger(page, "page");
    positiveInteger(size, "size");
    if (typeof isLast !== "boolean") {
      throw new YingdaoAuthError("isLast must be a boolean");
    }
    stringArray(scheduleUuidList, "scheduleUuidList");
    stringArray(statusList, "statusList");

    return this.request("/api/dispatch/v3/scene/inst/page", {
      method: "POST",
      body: { page, size, isLast, scheduleUuidList, statusList },
      signal,
      operation: "List execution records",
    });
  }

  async getExceptionDetails({
    sceneInstUuid,
    robotClientUuid,
    page = 1,
    size = 10,
    signal,
  } = {}) {
    requireString(sceneInstUuid, "sceneInstUuid");
    requireString(robotClientUuid, "robotClientUuid");
    positiveInteger(page, "page");
    positiveInteger(size, "size");

    return this.request("/api/dispatch/v2/scene/inst/job/list", {
      query: { sceneInstUuid, robotClientUuid, size, page },
      signal,
      operation: "Get exception details",
    });
  }

  async getAppStatistics({
    page = 1,
    size = 100,
    startStatisticDate,
    endStatisticDate,
    sortBy = "3",
    signal,
  } = {}) {
    positiveInteger(page, "page");
    positiveInteger(size, "size");
    isoDate(startStatisticDate, "startStatisticDate");
    isoDate(endStatisticDate, "endStatisticDate");
    if (startStatisticDate > endStatisticDate) {
      throw new YingdaoAuthError("startStatisticDate cannot be after endStatisticDate");
    }
    requireString(sortBy, "sortBy");

    return this.request("/api/console/statistic/data/appList", {
      method: "POST",
      body: { page, size, startStatisticDate, endStatisticDate, sortBy },
      signal,
      operation: "Get application statistics",
    });
  }

  async getAppStatisticsTotal({
    startStatisticDate,
    endStatisticDate,
    signal,
  } = {}) {
    isoDate(startStatisticDate, "startStatisticDate");
    isoDate(endStatisticDate, "endStatisticDate");
    if (startStatisticDate > endStatisticDate) {
      throw new YingdaoAuthError("startStatisticDate cannot be after endStatisticDate");
    }

    return this.request("/api/console/statistic/data/appListTotal", {
      method: "POST",
      body: {
        page: 1,
        size: 100,
        startStatisticDate,
        endStatisticDate,
      },
      signal,
      operation: "Get application statistics total",
    });
  }

  async getTenantDailyRuntime({ days = 7, signal } = {}) {
    positiveInteger(days, "days", 31);
    return this.request("/api/console/statistic/data/tenant/days", {
      method: "POST",
      body: { days },
      signal,
      operation: "Get tenant daily runtime",
    });
  }
}
