/** Sound effects (Kenney.nl Casino Audio pack, CC0 — see public/sounds/LICENSE.txt). */

const NAMES = ['card', 'deal', 'trick', 'turn', 'win'] as const;
export type SoundName = (typeof NAMES)[number];

const clips = new Map<SoundName, HTMLAudioElement>();
for (const name of NAMES) {
  // BASE_URL-relative so the path resolves both on the web and under file:// in Electron.
  const clip = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
  clip.preload = 'auto';
  clips.set(name, clip);
}

let muted = localStorage.getItem('thab_muted') === '1';

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem('thab_muted', value ? '1' : '0');
}

export function play(name: SoundName): void {
  if (muted) return;
  // Clone so rapid repeats overlap instead of restarting the same element.
  const clip = clips.get(name)!.cloneNode() as HTMLAudioElement;
  clip.volume = 0.55;
  // Rejected until the user has interacted with the page (autoplay policy) — fine to drop.
  clip.play().catch(() => {});
}
