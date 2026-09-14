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
  mount?: (ctx: MountCtx) => () => void;
}
