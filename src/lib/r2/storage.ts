import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getR2BucketName, getR2Client } from "./client";

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 5 * 60;

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    }),
  );
}

const DELETE_OBJECTS_MAX_KEYS = 1000;

export async function deleteObjects(keys: string[]): Promise<void> {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const failedKeys: string[] = [];

  for (let start = 0; start < keys.length; start += DELETE_OBJECTS_MAX_KEYS) {
    const chunk = keys.slice(start, start + DELETE_OBJECTS_MAX_KEYS);
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    for (const error of response.Errors ?? []) {
      if (error.Key) {
        failedKeys.push(error.Key);
      }
    }
  }

  if (failedKeys.length > 0) {
    throw new Error(`Failed to delete ${failedKeys.length} R2 object(s)`);
  }
}

export async function deleteObjectsByPrefix(prefix: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2BucketName();
  let continuationToken: string | undefined;

  do {
    const listResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys =
      listResponse.Contents?.map((object) => object.Key).filter(
        (key): key is string => Boolean(key),
      ) ?? [];

    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
          },
        }),
      );
    }

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);
}

export type ObjectMetadata = {
  size: number;
  contentType: string | null;
};

export async function getObjectMetadata(
  key: string,
): Promise<ObjectMetadata | null> {
  const client = getR2Client();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
      }),
    );

    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
    };
  } catch (error) {
    if (error instanceof NotFound) {
      return null;
    }

    throw error;
  }
}

export async function getObject(key: string) {
  const client = getR2Client();

  return client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    }),
  );
}

export async function getObjectByteRange(
  key: string,
  start: number,
  end: number,
): Promise<Buffer> {
  const client = getR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Range: `bytes=${start}-${end}`,
    }),
  );

  const bytes = await response.Body?.transformToByteArray();

  return Buffer.from(bytes ?? []);
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(client, command, {
    expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
  });
}
