import type { DEFAULT_COMPOSITION_SCHEMA } from "@/remotion/default-composition/constants";
import type {
  ProgressRequest,
  ProgressResponse,
  RenderRequest,
} from "@/remotion/domain/schema";

import type { ApiResponse } from "./api-response";

import type { RenderMediaOnLambdaOutput } from "@remotion/lambda/client";
import type { z } from "zod";

async function makeRequest<Res>(endpoint: string, body: unknown): Promise<Res> {
  const result = await fetch(endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
  const json = (await result.json()) as ApiResponse<Res>;
  if (json.type === "error") {
    throw new Error(json.message);
  }

  return json.data;
}

export async function renderVideo({
  id,
  inputProps,
  fileName,
}: {
  id: string;
  inputProps: z.infer<typeof DEFAULT_COMPOSITION_SCHEMA>;
  fileName: string;
}) {
  const body: z.infer<typeof RenderRequest> & { fileName: string } = {
    id,
    inputProps,
    fileName,
  };

  return makeRequest<RenderMediaOnLambdaOutput>("/api/lambda/render", body);
}

export async function getProgress({
  id,
  bucketName,
}: {
  id: string;
  bucketName: string;
}) {
  const body: z.infer<typeof ProgressRequest> = {
    id,
    bucketName,
  };

  return makeRequest<ProgressResponse>("/api/lambda/progress", body);
}
