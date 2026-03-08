export type ProgressLevel = 0 | 1 | 2 | 3;

export type ProgressInfo = {
  count: number;
  level: ProgressLevel;
  percent: number;
  nextTarget: number | null;
  label: string;
};

export type ProgressSummary = {
  global: ProgressInfo;
  periods: ProgressInfo;
  events: ProgressInfo;
  memories: ProgressInfo;
};

const PROGRESSION_THRESHOLDS = {
  global: { n1: 4, n2: 8, n3: 15 },
  periods: { n1: 4, n2: 7, n3: 12 },
  events: { n1: 8, n2: 15, n3: 30 },
  memories: { n1: 20, n2: 40, n3: 80 },
};

function getLevelLabel(level: ProgressLevel): string {
  switch (level) {
    case 0:
      return "Début";
    case 1:
      return "Niveau 1 atteint";
    case 2:
      return "Niveau 2 atteint";
    case 3:
      return "Niveau 3 atteint";
    default:
      return "Début";
  }
}

function computeOne(count: number, thresholds: { n1: number; n2: number; n3: number }): ProgressInfo {
  let level: ProgressLevel = 0;
  let nextTarget: number | null = thresholds.n1;
  let percent = 0;

  if (count >= thresholds.n3) {
    level = 3;
    nextTarget = null;
    percent = 100;
  } else if (count >= thresholds.n2) {
    level = 2;
    nextTarget = thresholds.n3;
    percent = Math.round((count / thresholds.n3) * 100);
  } else if (count >= thresholds.n1) {
    level = 1;
    nextTarget = thresholds.n2;
    percent = Math.round((count / thresholds.n3) * 100);
  } else {
    level = 0;
    nextTarget = thresholds.n1;
    percent = Math.round((count / thresholds.n3) * 100);
  }

  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;

  return {
    count,
    level,
    percent,
    nextTarget,
    label: getLevelLabel(level),
  };
}

export function computeProgressSummary(params: {
  validatedChaptersCount: number;
  periodsCount: number;
  eventsCount: number;
  memoriesCount: number;
}): ProgressSummary {
  return {
    global: computeOne(params.validatedChaptersCount, PROGRESSION_THRESHOLDS.global),
    periods: computeOne(params.periodsCount, PROGRESSION_THRESHOLDS.periods),
    events: computeOne(params.eventsCount, PROGRESSION_THRESHOLDS.events),
    memories: computeOne(params.memoriesCount, PROGRESSION_THRESHOLDS.memories),
  };
}