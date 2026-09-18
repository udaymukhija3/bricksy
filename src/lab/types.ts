export interface MountCtx {
  stageEl: HTMLElement;
  panelEl: HTMLElement;
  hudEl: HTMLElement;
  hintEl: HTMLElement;
}

export interface SketchDef {
  id: string;
  title: string;
  tagline: string;
  /** The cognitive operation the mechanic is meant to require. */
  skill: string;
  status: 'flagship' | 'playable' | 'concept';
  icon?: string;
  href?: string;
  /** Why this game exists: the skill it isolates and what stops a player from bypassing it. */
  about?: string;
  /** One line of controls (keys and gestures). */
  controls?: string;
  mount?: (ctx: MountCtx) => () => void;
}
