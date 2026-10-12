export const runSerializableTransaction = async (database, operation, maxRetries = 2) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
};
