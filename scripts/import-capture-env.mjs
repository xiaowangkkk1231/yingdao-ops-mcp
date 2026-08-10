import fs from "node:fs";
import path from "node:path";

const capturePath = process.argv[2];
if (!capturePath) {
  throw new Error("Usage: node scripts/import-capture-env.mjs <curl-capture.txt>");
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
const username = capturedUrl.searchParams.get("username");
const encryptedPassword = capturedUrl.searchParams.get("password");
if (!username || !encryptedPassword) {
  throw new Error("Username or encrypted password is missing from capture");
}

const destination = path.resolve(process.cwd(), ".env");
fs.writeFileSync(
  destination,
  [
    `YINGDAO_USERNAME=${username}`,
    `YINGDAO_ENCRYPTED_PASSWORD=${encryptedPassword}`,
    `YINGDAO_BASIC_AUTH=${basicAuth}`,
    "",
  ].join("\n"),
  { encoding: "utf8", mode: 0o600 },
);

process.stdout.write(
  `${JSON.stringify({ created: destination, keys: ["YINGDAO_USERNAME", "YINGDAO_ENCRYPTED_PASSWORD", "YINGDAO_BASIC_AUTH"] })}\n`,
);
