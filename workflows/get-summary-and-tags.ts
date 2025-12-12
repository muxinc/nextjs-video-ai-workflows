import { getSummaryAndTags } from "@mux/ai/workflows";

export type GetSummaryAndTagsOptions = Parameters<typeof getSummaryAndTags>[1];
export type GetSummaryAndTagsResult = Awaited<ReturnType<typeof getSummaryAndTags>>;

export async function getSummaryAndTagsWorkflow(
  assetId: string,
  options?: GetSummaryAndTagsOptions,
): Promise<GetSummaryAndTagsResult> {
  "use workflow";
  return await getSummaryAndTags(assetId, options);
}
