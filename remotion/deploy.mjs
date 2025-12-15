import path from "node:path";

import {
  deployFunction,
  deploySite,
  getOrCreateBucket,
} from "@remotion/lambda";
import dotenv from "dotenv";

import { DISK, RAM, REGION, SITE_NAME, TIMEOUT } from "./config.mjs";
import { webpackOverride } from "./webpack-override.mjs";

console.warn("Selected region:", REGION);
dotenv.config();

if (!process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  console.error(
    "The environment variable \"REMOTION_AWS_ACCESS_KEY_ID\" is not set.",
  );
  console.error("Lambda renders were not set up.");
  console.error(
    "Complete the Lambda setup: at https://www.remotion.dev/docs/lambda/setup",
  );
  process.exit(0);
}
if (!process.env.REMOTION_AWS_SECRET_ACCESS_KEY
) {
  console.error(
    "The environment variable \"REMOTION_REMOTION_AWS_SECRET_ACCESS_KEY\" is not set.",
  );
  console.error("Lambda renders were not set up.");
  console.error(
    "Complete the Lambda setup: at https://www.remotion.dev/docs/lambda/setup",
  );
  process.exit(0);
}

process.stdout.write("Deploying Lambda function... ");

const { functionName, alreadyExisted: functionAlreadyExisted } =
  await deployFunction({
    createCloudWatchLogGroup: true,
    memorySizeInMb: RAM,
    region: REGION,
    timeoutInSeconds: TIMEOUT,
    diskSizeInMb: DISK,
  });
console.warn(
  functionName,
  functionAlreadyExisted ? "(already existed)" : "(created)",
);

process.stdout.write("Ensuring bucket... ");
const { bucketName, alreadyExisted: bucketAlreadyExisted } =
  await getOrCreateBucket({
    region: REGION,
  });
console.warn(
  bucketName,
  bucketAlreadyExisted ? "(already existed)" : "(created)",
);

process.stdout.write("Deploying site... ");
const { siteName } = await deploySite({
  bucketName,
  entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
  siteName: SITE_NAME,
  region: REGION,
  options: { webpackOverride },
});

console.warn(siteName);

console.warn();
console.warn("You now have everything you need to render videos!");
console.warn("Re-run this command when:");
console.warn("  1) you changed the video template");
console.warn("  2) you changed config.mjs");
console.warn("  3) you upgraded Remotion to a newer version");
