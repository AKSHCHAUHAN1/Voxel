import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from './redis.js';

export const createQueue = (queueName) => {
  const queue = new Queue(queueName, { connection: redis });
  const queueEvents = new QueueEvents(queueName, { connection: redis });

  return { queue, queueEvents };
};

export const createWorker = (queueName, processor, options = {}) => {
  const worker = new Worker(queueName, processor, {
    connection: redis,
    ...options,
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
  });

  worker.on('error', (err) => {
    console.error(`Worker error in queue ${queueName}:`, err);
  });

  return worker;
};
