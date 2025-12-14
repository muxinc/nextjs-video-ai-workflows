import type { TranscriptCue } from "@/app/media/types";

/**
 * Parses VTT timestamp to seconds.
 * Format: "00:00:00.000" or "00:00.000"
 */
function parseVttTime(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (
      Number.parseInt(hours, 10) * 3600 +
      Number.parseInt(minutes, 10) * 60 +
      Number.parseFloat(seconds)
    );
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Number.parseInt(minutes, 10) * 60 + Number.parseFloat(seconds);
  }
  return 0;
}

/**
 * Parses VTT content into structured cues.
 */
export function parseVtt(vttContent: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  const lines = vttContent.split("\n");

  let i = 0;
  let cueIndex = 0;

  // Skip header
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map(s => s.trim());
      const startTime = parseVttTime(startStr);
      const endTime = parseVttTime(endStr);

      // Collect text lines until empty line or next timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].includes("-->")) {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          id: `cue-${cueIndex++}`,
          startTime,
          endTime,
          text: textLines.join(" "),
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}
