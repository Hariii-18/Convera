const FALLBACK_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Every IANA timezone the runtime knows about, "Asia/Kolkata" pinned first
 * since it's the app default. Falls back to a curated list on runtimes
 * without `Intl.supportedValuesOf` (older browsers). */
export function listTimezones(): string[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf?.("timeZone") ?? FALLBACK_TIMEZONES;
  } catch {
    zones = FALLBACK_TIMEZONES;
  }

  return [
    "Asia/Kolkata",
    ...zones.filter((zone) => zone !== "Asia/Kolkata").sort(),
  ];
}
