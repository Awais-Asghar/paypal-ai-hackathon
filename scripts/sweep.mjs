// Render cron job: asks the web service to run the Payment Gate's scheduler (ends cooling-off
// timers, voids holds before the authorization deadline, retries stuck steps).
// Needs SWEEP_HOSTPORT (the web service on Render's private network) or SWEEP_URL, and CRON_SECRET.
const target = process.env.SWEEP_URL || `http://${process.env.SWEEP_HOSTPORT}/api/cron/sweep`;
const res = await fetch(target, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(`sweep ${res.status}: ${(await res.text()).slice(0, 2000)}`);
if (!res.ok) process.exitCode = 1;
