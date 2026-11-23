/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Fill direction on old transactions, update indexes, list duplicate payouts.
// Run: node dist/scripts/migrateTransactions.js [--apply]
import mongoose from 'mongoose';
import config from '../app/config';
import { deriveTransactionDirection } from '../app/modules/transaction/transaction.enum';
import Transaction from '../app/modules/transaction/transaction.model';

const OBSOLETE_INDEXES = ['venueOwner_1', 'order_1', 'type_1', 'status_1'];

const run = async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(config.database_url as string);
  const collection = Transaction.collection;

  const cursor = collection.find(
    { direction: { $exists: false } },
    { projection: { _id: 1, type: 1, 'metadata.reason': 1 } },
  );
  let ops: any[] = [];
  let missing = 0;
  for await (const doc of cursor) {
    missing += 1;
    ops.push({
      updateOne: {
        filter: { _id: doc._id, direction: { $exists: false } },
        update: {
          $set: {
            direction: deriveTransactionDirection(
              doc.type,
              doc.metadata?.reason,
            ),
          },
        },
      },
    });
    if (apply && ops.length === 500) {
      await collection.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }
  if (apply && ops.length) await collection.bulkWrite(ops, { ordered: false });
  console.log(
    `${apply ? 'Set' : 'Would set'} direction on ${missing} transaction(s)`,
  );

  const existing = (await collection.indexes()).map((i) => i.name);
  const toDrop = OBSOLETE_INDEXES.filter((n) => existing.includes(n));
  console.log(
    `${apply ? 'Dropping' : 'Would drop'} obsolete indexes: ${toDrop.join(', ') || 'none'}`,
  );
  if (apply) {
    await Transaction.createIndexes();
    for (const name of toDrop) await collection.dropIndex(name);
  }

  const dupes = await collection
    .aggregate([
      { $match: { stripePayoutId: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$stripePayoutId',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (dupes.length) {
    console.log(
      `\n${dupes.length} payout(s) recorded more than once (review and delete extras manually):`,
    );
    for (const d of dupes) console.log(`  ${d._id}: ${d.ids.join(', ')}`);
  }

  if (!apply) console.log('\nDry run only. Re-run with --apply to write.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
