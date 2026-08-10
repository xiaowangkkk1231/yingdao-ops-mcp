import assert from "node:assert/strict";
import test from "node:test";

import { YingdaoAuthClient, encryptPassword } from "../src/yingdao-auth.mjs";

test("encryptPassword produces an RSA ciphertext", () => {
  const encrypted = encryptPassword("example-password");

  assert.equal(Buffer.from(encrypted, "base64").length, 128);
});

test("login obtains a credential and returns access_token", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return new Response(
        JSON.stringify({ success: true, code: 200, data: { credential: "nonce" } }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ access_token: "token-value", token_type: "bearer", expires_in: 3600 }),
      { status: 200 },
    );
  };
  const client = new YingdaoAuthClient({
    basicAuth: "client-credentials",
    fetchImpl,
  });

  const result = await client.login({
    username: "account",
    encryptedPassword: "encrypted-value",
  });

  assert.equal(result.accessToken, "token-value");
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /requestCredential\/get$/);
  assert.match(calls[1].url, /oauth\/token\/v2\?/);
  assert.equal(calls[1].options.headers["x-credential"], "nonce");
  assert.equal(calls[1].options.headers.authorization, "Basic client-credentials");
  assert.equal(new URL(calls[1].url).searchParams.get("password"), "encrypted-value");
});

test("login supports wrapped token responses", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return callCount === 1
      ? new Response(JSON.stringify({ data: { credential: "nonce" } }), { status: 200 })
      : new Response(JSON.stringify({ data: { access_token: "wrapped-token" } }), {
          status: 200,
        });
  };
  const client = new YingdaoAuthClient({ basicAuth: "Basic value", fetchImpl });

  const result = await client.login({
    username: "account",
    encryptedPassword: "encrypted-value",
  });

  assert.equal(result.accessToken, "wrapped-token");
});
