import fs from "node:fs";

import { YingdaoAuthClient } from "../src/yingdao-auth.mjs";

const capturePath = process.argv[2];
if (!capturePath) {
  throw new Error("Usage: node scripts/verify-captured-login.mjs <curl-capture.txt>");
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
const client = new YingdaoAuthClient({ basicAuth });
const result = await client.login({
  username: capturedUrl.searchParams.get("username"),
  encryptedPassword: capturedUrl.searchParams.get("password"),
});

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      accessToken: "[hidden]",
      tokenLength: result.accessToken.length,
    },
    null,
    2,
  )}\n`,
);
