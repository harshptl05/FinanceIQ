/* Lightweight inline icon set so we don't ship a whole icon library
   and can keep them all stroke-styled and consistent.
   All icons accept a `className` and inherit currentColor. */

const base = 'w-[1.1em] h-[1.1em] flex-shrink-0'
const sw = 1.75

function Svg({ children, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconOverview = (p) => (
  <Svg {...p}>
    <path d="M3 12l2-2 4 4 4-7 4 4 4-3" />
    <path d="M3 20h18" />
  </Svg>
)
export const IconGoals = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </Svg>
)
export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
)
export const IconChat = (p) => (
  <Svg {...p}>
    <path d="M4 5h16v11H8l-4 3V5Z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
)
export const IconBalance = (p) => (
  <Svg {...p}>
    <path d="M12 4v16" />
    <path d="M5 8h14" />
    <path d="M8 8l-3 6a3 3 0 0 0 6 0L8 8Z" />
    <path d="M16 8l-3 6a3 3 0 0 0 6 0L16 8Z" />
  </Svg>
)
export const IconScenario = (p) => (
  <Svg {...p}>
    <path d="M3 17l5-5 4 4 8-9" />
    <path d="M14 7h6v6" />
  </Svg>
)
export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </Svg>
)
export const IconSync = IconRefresh
export const IconArrow = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </Svg>
)
export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
)
export const IconX = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M6 18L18 6" />
  </Svg>
)
export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    <path d="M5.5 5.5l3 3M15.5 15.5l3 3M18.5 5.5l-3 3M8.5 15.5l-3 3" />
  </Svg>
)
export const IconShield = (p) => (
  <Svg {...p}>
    <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" />
  </Svg>
)
export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
  </Svg>
)
export const IconCap = (p) => (
  <Svg {...p}>
    <path d="M3 9l9-4 9 4-9 4-9-4Z" />
    <path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4" />
  </Svg>
)
export const IconPalm = (p) => (
  <Svg {...p}>
    <path d="M12 22V11" />
    <path d="M12 11c0-3-2-5-5-5" />
    <path d="M12 11c0-3 2-5 5-5" />
    <path d="M12 11c-2-1.5-5-1.5-7 0" />
    <path d="M12 11c2-1.5 5-1.5 7 0" />
  </Svg>
)
export const IconTarget = IconGoals
