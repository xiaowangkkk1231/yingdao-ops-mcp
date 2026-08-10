import { constants, publicEncrypt } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.yingdao.com";
const PUBLIC_KEY_BASE64 =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGx1Bd+8CbNJe9UGlXbq1pCzFJUoaO5CLQw0VWp8Obuic+M+sM3W2TV+6dguMHUMe+wyn7lTWIyiQnSgMD1sEA231m9CtFJOBTFqPjAJxGICO07bCJoKPlDwW5Dl79t4YiwyKI//oqP5eoeYGiuoN2ihjonW4smRLkM3+7VlrEyQIDAQAB";

function toPublicKeyPem(base64Key) {
  const lines = base64Key.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

function normalizeBasicAuth(value) {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith("basic ")
    ? trimmed
    : `Basic ${trimmed}`;
}

export async function readYingdaoJson(response, operation) {
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new YingdaoAuthError(`${operation} returned non-JSON data`, {
      status: response.status,
    });
  }

  if (!response.ok) {
    throw new YingdaoAuthError(`${operation} failed with HTTP ${response.status}`, {
      status: response.status,
      code: payload.code,
      message: payload.msg ?? payload.message,
    });
  }

  return payload;
}

export class YingdaoAuthError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "YingdaoAuthError";
    this.details = details;
  }
}

export function encryptPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new YingdaoAuthError("Password is required");
  }

  return publicEncrypt(
    {
      key: toPublicKeyPem(PUBLIC_KEY_BASE64),
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(password, "utf8"),
  ).toString("base64");
}

export class YingdaoAuthClient {
  constructor({
    basicAuth,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!basicAuth) {
      throw new YingdaoAuthError("YINGDAO_BASIC_AUTH is required");
    }
    if (typeof fetchImpl !== "function") {
      throw new YingdaoAuthError("A Fetch API implementation is required");
    }

    this.basicAuth = normalizeBasicAuth(basicAuth);
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  commonHeaders() {
    return {
      accept: "application/json",
      "accept-language": "zh-CN",
      origin: "https://console.yingdao.com",
      referer: "https://console.yingdao.com/",
      timezone: encodeURIComponent("+08:00"),
      "x-from": "console",
    };
  }

  async getRequestCredential({ signal } = {}) {
    const response = await this.fetch(
      `${this.baseUrl}/api/noauth/requestCredential/get`,
      {
        method: "GET",
        headers: this.commonHeaders(),
        signal,
      },
    );
    const payload = await readYingdaoJson(response, "Request credential");
    const credential = payload?.data?.credential;

    if (!credential) {
      throw new YingdaoAuthError("Request credential is missing from response", {
        code: payload?.code,
        message: payload?.msg ?? payload?.message,
      });
    }

    return credential;
  }

  async login({ username, password, encryptedPassword, signal } = {}) {
    if (!username) {
      throw new YingdaoAuthError("Username is required");
    }
    if (!password && !encryptedPassword) {
      throw new YingdaoAuthError("Password is required");
    }

    const credential = await this.getRequestCredential({ signal });
    const params = new URLSearchParams({
      username,
      password: encryptedPassword || encryptPassword(password),
      crypt: "fire",
      grant_type: "password",
      scope: "all",
    });
    const response = await this.fetch(
      `${this.baseUrl}/oauth/token/v2?${params.toString()}`,
      {
        method: "POST",
        headers: {
          ...this.commonHeaders(),
          authorization: this.basicAuth,
          "x-credential": credential,
        },
        signal,
      },
    );
    const payload = await readYingdaoJson(response, "Login");
    const accessToken = payload.access_token ?? payload?.data?.access_token;

    if (!accessToken) {
      throw new YingdaoAuthError("access_token is missing from login response", {
        code: payload?.code,
        message: payload?.msg ?? payload?.message,
      });
    }

    return {
      accessToken,
      tokenType: payload.token_type ?? payload?.data?.token_type ?? "Bearer",
      expiresIn: payload.expires_in ?? payload?.data?.expires_in ?? null,
      raw: payload,
    };
  }
}
