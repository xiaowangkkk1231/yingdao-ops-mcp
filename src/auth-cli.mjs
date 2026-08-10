import { YingdaoAuthClient, YingdaoAuthError } from "./yingdao-auth.mjs";

const showToken = process.argv.includes("--print-token");
const username = process.env.YINGDAO_USERNAME;
const password = process.env.YINGDAO_PASSWORD;
const encryptedPassword = process.env.YINGDAO_ENCRYPTED_PASSWORD;
const basicAuth = process.env.YINGDAO_BASIC_AUTH;

try {
  const client = new YingdaoAuthClient({ basicAuth });
  const result = await client.login({ username, password, encryptedPassword });

  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        accessToken: showToken ? result.accessToken : "[hidden]",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const output = {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };

  if (error instanceof YingdaoAuthError && error.details.code !== undefined) {
    output.code = error.details.code;
  }

  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
}
