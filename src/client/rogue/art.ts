/**
 * Doré plates (public domain, see public/art/LICENSE.txt) for the 19 gates.
 * Dante's own geography, stop by stop: the circles of the Inferno down to
 * Lucifer, then up through the spheres of the Paradiso to the Rose.
 */
export interface GateArt {
  src: string;
  caption: string;
}

export const GATE_ART: GateArt[] = [
  { src: '/art/gate-0.jpg', caption: 'Inferno IV — Limbo' },
  { src: '/art/gate-1.jpg', caption: 'Inferno V — Minos' },
  { src: '/art/gate-2.jpg', caption: 'Inferno VI — Cerberus' },
  { src: '/art/gate-3.jpg', caption: 'Inferno VII — Plutus' },
  { src: '/art/gate-4.jpg', caption: 'Inferno VIII — the Styx' },
  { src: '/art/gate-5.jpg', caption: 'Inferno IX — the arch-heretics' },
  { src: '/art/gate-6.jpg', caption: 'Inferno XII — the Minotaur' },
  { src: '/art/gate-7.jpg', caption: 'Inferno XVII — Geryon' },
  { src: '/art/gate-8.jpg', caption: 'Inferno XXXI — Antaeus' },
  { src: '/art/bottom.jpg', caption: 'Inferno XXXIV — Lucifer' },
  { src: '/art/gate-10.jpg', caption: 'Paradiso III — the Moon' },
  { src: '/art/gate-11.jpg', caption: 'Paradiso V — Mercury' },
  { src: '/art/gate-12.jpg', caption: 'Paradiso VIII — Venus' },
  { src: '/art/gate-13.jpg', caption: 'Paradiso XII — the Sun' },
  { src: '/art/gate-14.jpg', caption: 'Paradiso XIV — Mars' },
  { src: '/art/gate-15.jpg', caption: 'Paradiso XVIII — Jupiter' },
  { src: '/art/gate-16.jpg', caption: 'Paradiso XXI — Saturn' },
  { src: '/art/gate-17.jpg', caption: 'Paradiso XXVII — the Fixed Stars' },
  { src: '/art/heaven.jpg', caption: 'Paradiso XXXI — the Rosa Celeste' }
];
