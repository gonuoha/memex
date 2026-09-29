import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getR2BucketName, getR2Client } from "./client";

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

export async function getObjectSize(key: string): Promise<number | null> {
  const client = getR2Client();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
      }),
    );

    return response.ContentLength ?? null;
  } catch (error) {
    if (error instanceof NotFound) {
      return null;
    }

    throw error;
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

export async function getObject(key: string) {
  const client = getR2Client();

  return client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    }),
  );
}
