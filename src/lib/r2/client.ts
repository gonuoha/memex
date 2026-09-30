import { S3Client } from "@aws-sdk/client-s3";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getR2Client() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    // Presigned URLs must stay on the account origin allowed by CSP connect-src.
    forcePathStyle: true,
    // Default checksums embed an empty-body CRC32 in presigned PUT URLs, which real uploads then fail.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function getR2BucketName() {
  return getRequiredEnv("R2_BUCKET_NAME");
}

export function getR2ConnectSrcOrigin(): string {
  const accountId = process.env.R2_ACCOUNT_ID;

  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return "https://*.r2.cloudflarestorage.com";
}
