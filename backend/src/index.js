import {createWatchServer} from './server.js';

const {config, httpServer} = createWatchServer();
httpServer.listen(config.port, () => {
  console.log(`WatchTogether server listening on port ${config.port}`);
  console.log(`Allowed origins: ${config.clientOrigins.join(', ')}`);
});