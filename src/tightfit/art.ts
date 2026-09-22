import { h } from '../lab/kit.ts';

/** Original, code-native illustrations. No downloaded assets or external font requests. */
export function vanArt() {
  const el = h('div.tf-illustration');
  el.innerHTML = `<svg viewBox="0 0 620 410" role="img" aria-label="A little green moving van carrying a lamp, a chair, and far too many boxes through the neighborhood">
  <defs><pattern id="tf-grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="#294b40" opacity=".1"/></pattern></defs>
  <circle cx="335" cy="184" r="161" fill="#e8bb6a" opacity=".3"/>
  <path d="M19 315 Q150 239 308 289 T613 296 L620 410 H0Z" fill="#c5d0ad"/>
  <g fill="#ded7bd" stroke="#b2b79e" stroke-width="2"><path d="M38 257V137l59-44 59 44v120Z"/><path d="M452 235V110l49-30 50 30v144Z"/></g>
  <g fill="#f8f0d9"><path d="M66 155h24v33H66zM107 155h24v33h-24zM479 127h16v26h-16zM515 127h16v26h-16z"/></g>
  <path d="M21 305L554 372" stroke="#f6efd9" stroke-width="19" stroke-linecap="round"/>
  <ellipse cx="325" cy="339" rx="201" ry="24" fill="#244a3e" opacity=".14"/>
  <g stroke="#23483d" stroke-width="3" stroke-linejoin="round">
  <path d="M125 200L318 164 454 212 262 253Z" fill="#537e62"/>
  <path d="M125 200L262 253V334L125 280Z" fill="#214b3d"/>
  <path d="M262 253L454 212V298L262 334Z" fill="#38644e"/>
  <path d="M319 164V116l51-11 45 21v70Z" fill="#b6754d"/>
  <path d="M319 116l43 22 53-12M362 138v67" fill="none"/>
  <path d="M253 174V99l42-10 30 12v86Z" fill="#d9a664"/>
  <path d="M253 99l31 14 41-12M284 113v77" fill="none"/>
  <path d="M211 184V143l-37-16v-47l48 15 24 12v98Z" fill="#d78d5d"/>
  <path d="M174 80l37-9 35 14v22l-24-12Z" fill="#edb480"/>
  <path d="M163 144l48 18 35-8v27l-35 8-48-18Z" fill="#e5a370"/>
  <path d="M211 189v29M163 171v24M246 181v27"/>
  <path d="M292 149V53" stroke="#98632e" stroke-width="8"/>
  <path d="M267 54l9-34h34l14 34Z" fill="#f1c468" stroke="#a67539"/>
  <path d="M274 155l21-7 23 9-22 6Z" fill="#ab793e"/>
  <path d="M454 212l48-8 50 39v59l-98-4Z" fill="#7c9a71"/>
  <path d="M474 216l27-3 37 32-64 10Z" fill="#c7e0d3"/>
  <path d="M474 261v33M540 252v39" stroke="#426b52"/>
  <path d="M125 236l137 50 192-40" fill="none" stroke="#f0c276" stroke-width="13"/>
  <path d="M127 233l135 50 192-40" fill="none" stroke="#f9dc99" stroke-width="2"/>
  <ellipse cx="185" cy="310" rx="24" ry="32" fill="#243c35"/><ellipse cx="185" cy="310" rx="11" ry="17" fill="#c7c6ac"/>
  <ellipse cx="474" cy="315" rx="24" ry="32" fill="#243c35"/><ellipse cx="474" cy="315" rx="11" ry="17" fill="#c7c6ac"/>
  <path d="M536 275l17-2v11l-17 2Z" fill="#f8d07b"/>
  </g>
  <g fill="#244b3d"><path d="M66 296v-61h7v63Z"/><circle cx="69" cy="222" r="30"/><circle cx="50" cy="238" r="25"/><circle cx="89" cy="240" r="25"/>
  <path d="M573 300v-84h6v85Z"/><circle cx="576" cy="197" r="29"/><circle cx="560" cy="218" r="26"/></g>
  <path d="M388 84q10-12 21 0q10-12 21 0M449 55q7-9 15 0q7-9 15 0" fill="none" stroke="#6f7e67" stroke-width="2"/>
  <g transform="rotate(-11 347 285)"><text x="293" y="282" fill="#faf2da" font-family="Georgia,serif" font-size="27" font-weight="bold">Tight Fit</text><text x="300" y="298" fill="#e7d5aa" font-family="sans-serif" font-size="8" letter-spacing="2">NEIGHBORHOOD MOVERS</text></g>
  <rect width="620" height="410" fill="url(#tf-grain)" pointer-events="none"/>
  </svg>`;
  return el;
}

export function itemArt(name: string, color: number) {
  const el = h('div.tf-item-art', { 'aria-hidden': 'true' });
  const c = '#' + color.toString(16).padStart(6, '0');
  const drawings: Record<string, string> = {
    lamp: '<path d="M47 36h6v48h-6zM33 84h34v7H33z"/><path d="M30 36l8-26h25l9 26Z"/>',
    bookshelf: '<path d="M22 12h56v79H22z"/><path d="M28 37h44M28 62h44" stroke="#f5e9ce"/><path d="M32 19v15m9-15v15m10-15v15m10-15v15m-29 10v15m10-15v15m11-15v15m9-15v15m-30 10v18m11-18v18m12-18v18" stroke="#f5e9ce" stroke-width="5"/>',
    armchair: '<rect x="24" y="20" width="53" height="44" rx="13"/><rect x="15" y="51" width="17" height="30" rx="7"/><rect x="69" y="51" width="17" height="30" rx="7"/><path d="M32 59h37v23H32zM24 82v10M77 82v10"/>',
    fridge: '<rect x="27" y="9" width="47" height="82" rx="6"/><path d="M28 38h44M36 24v8m0 17v16" stroke="#f5e9ce"/>',
    'drum kit': '<circle cx="49" cy="64" r="26"/><circle cx="25" cy="36" r="15"/><circle cx="70" cy="33" r="17"/><path d="M12 17h24M77 10h20M84 10v77M20 50v38"/><circle cx="49" cy="64" r="18" fill="#f5e9ce"/>',
    piano: '<path d="M16 25h68v48H16zM22 73v20m55-20v20"/><path d="M16 61h68v14H16z" fill="#f5e9ce"/><path d="M27 62v9m10-9v9m14-9v9m10-9v9m10-9v9" stroke-width="5"/>',
    aquarium: '<path d="M12 26h77v51H12z"/><path d="M15 32h71v36H15z" fill="#b5d4c0"/><path d="M30 49q13-12 22 0q-9 12-22 0l-9-9v18z" fill="#d88350"/><path d="M20 78v14m61-14v14"/>',
    'brass telescope': '<path d="M18 41L75 16l10 24-57 25Z"/><path d="M50 55L28 93m22-38 23 38m-23-38v36"/>',
  };
  el.innerHTML = `<svg viewBox="0 0 100 105" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${drawings[name] ?? drawings.bookshelf}</svg>`;
  return el;
}
