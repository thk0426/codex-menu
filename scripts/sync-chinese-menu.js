// Run with the server stopped. Preserve room identities, votes, favorites and history.
const fs = require('node:fs');
const path = require('node:path');
const { commonChineseDishes } = require('../miniprogram/utils/model');
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../.data');
const file = path.join(dataDir, 'rooms.json');
if (!fs.existsSync(file)) {
  console.log('No saved rooms; new rooms will include the Chinese menu.');
} else {
  const rooms = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  let updated = 0;
  for (const room of Object.values(rooms)) {
    const before = JSON.stringify(room);
    const known = new Set(room.dishes.map(d => d.id));
    for (const dish of commonChineseDishes) {
      if (!known.has(dish.id)) { room.dishes.push(structuredClone(dish)); known.add(dish.id); added++; }
    }
    const rank = new Map(commonChineseDishes.map((dish, index) => [dish.id, index]));
    room.dishes.sort((a, b) => (rank.get(a.id) ?? 1000) - (rank.get(b.id) ?? 1000));
    for (const dish of [...room.dishes, ...(room.history || []).map(h => h.dish), room.proposal?.dish].filter(Boolean)) dish.price = 0;
    if (JSON.stringify(room) !== before) { room.version += 1; room.updatedAt = Date.now(); updated++; }
  }
  if (updated) {
    fs.copyFileSync(file, path.join(dataDir, `rooms-before-chinese-menu-${Date.now()}.json.bak`));
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(rooms));
    fs.renameSync(`${file}.tmp`, file);
  }
  console.log(`Added ${added} dishes across ${updated} existing rooms. All prices are 0.`);
}
