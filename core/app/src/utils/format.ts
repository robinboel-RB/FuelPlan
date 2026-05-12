export function parseDurationToMinutes(value: string): number | null {
  const parts = value.trim().split(":").map(Number);

  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes + seconds / 60;
  }

  const [hours, minutes, seconds] = parts;
  return hours * 60 + minutes + seconds / 60;
}

export function formatDurationInput(minutesValue: number): string {
  const totalSeconds = Math.max(0, Math.round(minutesValue * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function parsePaceToSpeedMPerMin(value: string): number | null {
  const minutes = parseDurationToMinutes(value);

  if (minutes === null || minutes <= 0) {
    return null;
  }

  return 1000 / minutes;
}

export function formatPaceInput(speedMPerMin: number): string {
  if (speedMPerMin <= 0) {
    return "00:00";
  }

  const secondsPerKm = Math.round((1000 / speedMPerMin) * 60);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatSigned(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${Math.round(value)}${unit}`;
}
