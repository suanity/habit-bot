import { sendReminders } from './index.js';

export default async function handler(req) {
  const count = await sendReminders();
  return new Response(`Sent to ${count} users`);
}
