async function getModeration (article: string) {
  'use step';

  return new Promise((resolve) => {
    setTimeout(() => resolve(`Moderation ${article}`), 1000);
  });
}

async function makeDecision (moderation: string) {
  'use step';

  return new Promise((resolve) => {
    setTimeout(() => resolve(`Decision: ${moderation}`), 1000);
  });
}

export async function moderationWorkflow(article: string) {
  'use workflow';
 
  const moderation = await getModeration(article);
 
  const decision = await makeDecision(moderation as string);

  return { moderation, decision };
}
