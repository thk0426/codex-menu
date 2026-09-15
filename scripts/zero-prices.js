// Run with the server stopped to update all saved menu and meal prices once.
const fs = require('node:fs');
const path = require('node:path');
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../.data');
const file = path.join(dataDir, 'rooms.json');
if (!fs.existsSync(file)) {
  console.log('No saved rooms to update.');
} else {
  const rooms = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  for (const room of Object.values(rooms)) {
    let roomChanged = false;
    const items = [...(room.dishes || []), ...(room.history || []).map(entry => entry.dish), room.proposal?.dish].filter(Boolean);
    for (const dish of items) {
      if (dish.price !== 0) { dish.price = 0; changed++; roomChanged = true; }
    }
    if (roomChanged) { room.version += 1; room.updatedAt = Date.now(); }
  }
  if (changed) {
    fs.copyFileSync(file, path.join(dataDir, `rooms-before-zero-${Date.now()}.json.bak`));
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(rooms));
    fs.renameSync(temp, file);
  }
  console.log(`Set ${changed} saved prices to 0 across ${Object.keys(rooms).length} rooms.`);
}
