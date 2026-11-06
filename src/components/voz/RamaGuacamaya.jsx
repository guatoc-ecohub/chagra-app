import { APOYOS } from './vueloGuacamaya';

export default function RamaGuacamaya({ apoyo }) {
  return (
    <svg className="voz-rama" data-apoyo={apoyo} viewBox="0 0 180 160" aria-hidden="true" focusable="false"
      style={{ left: `calc(${APOYOS[apoyo] * 100}% - ${apoyo ? 10 : 26}cqw)` }}>
      {/* La rama nace fuera del encuadre y ofrece corteza bajo las garras. */}
      <path d="M-32 166C-8 113 19 75 49 43C70 21 91 17 114 18L147 17L169 10L174 14L152 25
        C124 30 95 24 76 37C43 60 40 93 8 130L-12 166Z" fill="#514a32" stroke="#303d2b" strokeWidth="2" />
      <path d="M-23 157C-2 107 25 73 52 46C74 24 92 22 113 22L146 21L169 13"
        fill="none" stroke="#95815a" strokeWidth="3" strokeLinecap="round" />
      <path d="M11 151C28 112 30 83 49 63M44 65L62 45M80 31L99 27M114 25L130 25"
        fill="none" stroke="#363c29" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 52Q32 35 35 18M35 29L21 20M74 34Q77 21 73 11"
        fill="none" stroke="#514a32" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 30Q18 34 17 16Q32 15 35 30M74 21Q85 8 91 14Q89 26 74 21"
        fill="#61784b" />
      <path d="M24 97L29 83M51 48L60 41M85 27L93 25" fill="none" stroke="#80905c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
