export const STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS = 120;

type CloudflareStreamConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
};

type CloudflareStreamError = {
  code?: number;
  message?: string;
};

type CloudflareDirectUploadResponse = {
  success?: boolean;
  errors?: CloudflareStreamError[];
  result?: {
    uid?: string;
    uploadURL?: string;
  };
};

export type StreamDirectUpload = {
  uid: string;
  uploadURL: string;
  maxDurationSeconds: number;
};

export class CloudflareStreamConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareStreamConfigError";
  }
}

export class CloudflareStreamApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CloudflareStreamApiError";
    this.status = status;
  }
}

function getCloudflareStreamConfig(): CloudflareStreamConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();
  const missingConfig = [
    accountId ? null : "CLOUDFLARE_ACCOUNT_ID",
    apiToken ? null : "CLOUDFLARE_STREAM_API_TOKEN",
    customerCode ? null : "CLOUDFLARE_STREAM_CUSTOMER_CODE",
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    throw new CloudflareStreamConfigError(`Missing Cloudflare Stream configuration: ${missingConfig.join(", ")}.`);
  }

  if (!accountId || !apiToken || !customerCode) {
    throw new CloudflareStreamConfigError("Missing Cloudflare Stream configuration.");
  }

  return { accountId, apiToken, customerCode };
}

function getCloudflareErrorMessage(responseBody: CloudflareDirectUploadResponse) {
  return responseBody.errors?.find((error) => error.message)?.message ?? "Cloudflare Stream direct upload creation failed.";
}

function assertDirectUploadResponse(responseBody: CloudflareDirectUploadResponse): StreamDirectUpload {
  const uid = responseBody.result?.uid;
  const uploadURL = responseBody.result?.uploadURL;

  if (typeof uid !== "string" || uid.trim() === "" || typeof uploadURL !== "string" || uploadURL.trim() === "") {
    throw new CloudflareStreamApiError("Cloudflare Stream returned an invalid direct upload response.", 502);
  }

  return {
    uid,
    uploadURL,
    maxDurationSeconds: STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS,
  };
}

export async function createCloudflareStreamDirectUpload({
  creator,
  name,
}: {
  creator: string;
  name?: string;
}): Promise<StreamDirectUpload> {
  const { accountId, apiToken } = getCloudflareStreamConfig();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/direct_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "Upload-Creator": creator,
    },
    body: JSON.stringify({
      maxDurationSeconds: STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS,
      ...(name ? { meta: { name } } : {}),
    }),
  });
  const responseBody = await response.json().catch(() => null) as CloudflareDirectUploadResponse | null;

  if (!response.ok || !responseBody?.success) {
    throw new CloudflareStreamApiError(responseBody ? getCloudflareErrorMessage(responseBody) : "Cloudflare Stream returned a non-JSON response.", response.status);
  }

  return assertDirectUploadResponse(responseBody);
}
