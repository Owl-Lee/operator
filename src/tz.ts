/** Every time in schedule.json is wall-clock New York time with no zone, so the process must run in that zone
 *  wherever it is hosted. Imported first by every entry point. */
process.env.TZ ??= "America/New_York";
export {};
