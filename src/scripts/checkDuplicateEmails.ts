/* eslint-disable no-console */
// Lists users sharing the same email. The unique email index can't be built
// until these are merged or removed.
// Run: node dist/scripts/checkDuplicateEmails.js
import mongoose from 'mongoose';
import config from '../app/config';
import { User } from '../app/modules/user/user.model';

const run = async () => {
  await mongoose.connect(config.database_url as string);

  const dupes = await User.aggregate([
    { $match: { email: { $type: 'string', $gt: '' } } },
    {
      $group: {
        _id: '$email',
        count: { $sum: 1 },
        users: {
          $push: { id: '$_id', role: '$role', verified: '$isVerified' },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (!dupes.length) {
    console.log('No duplicate emails. The unique index will build on startup.');
  } else {
    console.log(`${dupes.length} email(s) used by more than one account:`);
    for (const d of dupes) {
      console.log(`  ${d._id}`);
      for (const u of d.users) {
        console.log(`    ${u.id} role=${u.role} verified=${u.verified}`);
      }
    }
  }
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
