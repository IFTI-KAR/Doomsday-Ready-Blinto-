import { AppDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);
const database = new AppDatabase();
database.seedIfEmpty();

const app = createApp(database);

app.listen(PORT, () => {
  console.log(`Doomsday Ready API server listening on http://localhost:${PORT}`);
});
