async function generateDraft (topic: string) {
  'use step';

  return new Promise((resolve) => {
    setTimeout(() => resolve(`Draft ${topic}`), 1000);
  });
}

async function summarizeDraft (draft: string) {
  'use step';

  return new Promise((resolve) => {
    setTimeout(() => resolve(`Summarize: ${draft}`), 1000);
  });
}

export async function aiContentWorkflow(topic: string) {
  'use workflow';
 
  const draft = await generateDraft(topic);
 
  const summary = await summarizeDraft(draft as string);

  return { draft, summary };
}
