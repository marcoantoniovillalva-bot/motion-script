import type { VideoProps } from './types';

export const defaultVideoProps: VideoProps = {
  title: 'AI vs. senza AI nella gestione clienti',
  day: 'Giovedì',
  date: '30/04/2026',
  format: 'vertical',
  source: {
    channel: 'soyenriquerocha',
    videoTitle: 'Claude ahora busca y te consigue clientes',
    url: 'https://www.facebook.com/reel/1676207793382999/',
  },
  scenes: [
    {
      start: 0,
      end: 4,
      role: 'hook',
      onScreenText: 'Gestisci ancora i clienti a mano?',
      visual: 'Headline grande e sfondo con card clienti',
      editNote: 'Parti diretto con energia, taglio rapido.',
    },
    {
      start: 4,
      end: 18,
      role: 'problem',
      onScreenText: 'Prima: messaggi persi, follow-up lenti',
      visual: 'Lista clienti con stati in ritardo',
      editNote: 'Mostra il problema in modo visivo.',
    },
    {
      start: 18,
      end: 42,
      role: 'solution',
      onScreenText: 'Dopo: AI che suggerisce chi contattare',
      visual: 'Dashboard con priorità e automazioni',
      editNote: 'Tre micro-benefici, uno alla volta.',
    },
    {
      start: 42,
      end: 62,
      role: 'example',
      onScreenText: 'Esempio: cliente inattivo da 60 giorni',
      visual: 'Messaggio personalizzato generato',
      editNote: 'Fai vedere una trasformazione pratica.',
    },
    {
      start: 62,
      end: 75,
      role: 'cta',
      onScreenText: 'Commenta CLIENTI',
      visual: 'CTA finale Marketizzati',
      editNote: 'Chiudi con brand e keyword.',
    },
  ],
  cta: 'Commenta CLIENTI',
  brand: {
    name: 'Marketizzati',
    tagline: 'AI pratica per PMI italiane',
    colors: {
      ink: '#101828',
      blue: '#155EEF',
      mint: '#12B76A',
      orange: '#F97316',
      paper: '#F8FAFC',
    },
  },
};
