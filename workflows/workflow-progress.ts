export async function writeToStream<T>(stream: WritableStream<T>, value: T) {
  const writer = stream.getWriter();
  try {
    await writer.write(value);
  } finally {
    writer.releaseLock();
  }
}

export async function closeStream<T>(stream: WritableStream<T>) {
  const writer = stream.getWriter();
  try {
    await writer.close();
  } finally {
    writer.releaseLock();
  }
}

export async function sleepMs(ms: number) {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}
