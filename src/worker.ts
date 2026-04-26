import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { config } from './config';
import { logger } from './logger';

async function run() {
  // Setup connection to server
  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'hotel-offers',
    // Workflows are registered using a path as they run in a separate sandboxed V8 context
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  logger.info({ address: config.temporalAddress }, 'Worker successfully connected to Temporal server');

  // Start accepting tasks on the `hotel-offers` queue
  await worker.run();
}

run().catch((err) => {
  logger.error({ err }, 'Worker failed to run');
  process.exit(1);
});
