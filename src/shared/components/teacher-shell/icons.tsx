import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function AlertIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 3.75 2.75 19.5h18.5L12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 9v4.5M12 17h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 10"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="m2 2 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="m20 20-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export function SidebarCollapseIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 25 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="25" height="24" rx="8" fill="currentColor" opacity="0.08" />
      <path
        d="M11.64 17 6.5 12l5.14-5 1.2 1.17L8.92 12l3.92 3.83L11.64 17ZM17.3 17l-5.14-5 5.14-5 1.2 1.17L14.58 12l3.92 3.83L17.3 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SidebarMenuIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3 18v-2h18v2H3Zm0-5v-2h18v2H3Zm0-5V6h18v2H3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SidebarGuideIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 23 27"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M16.86 0C20.8 0 23 2.4 23 6.52v13.95C23 24.65 20.8 27 16.86 27H6.15C2.26 27 0 24.65 0 20.47V6.52C0 2.4 2.26 0 6.15 0h10.71ZM6.49 18.55a1 1 0 0 0-.96.5 1.13 1.13 0 0 0 0 1.13c.2.34.58.54.96.49h10.02c.51-.05.89-.51.89-1.05 0-.56-.38-1.02-.89-1.07H6.49Zm10.02-6.16H6.49c-.55 0-1 .48-1 1.06 0 .58.45 1.05 1 1.05h10.02c.55 0 1-.47 1-1.05s-.45-1.06-1-1.06ZM10.31 6.28H6.49v.01c-.55 0-1 .47-1 1.05 0 .59.45 1.06 1 1.06h3.82c.55 0 1-.48 1-1.07 0-.58-.45-1.05-1-1.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SidebarMessageIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 21 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10.52 0C16.49 0 21 4.66 21 9.98 21 16.16 15.71 20 10.5 20c-1.72 0-3.63-.44-5.17-1.3-.53-.31-.98-.54-1.56-.36l-2.12.6c-.54.16-1.02-.24-.86-.78l.7-2.25c.12-.31.1-.64-.07-.9A9.99 9.99 0 0 1 0 10.02C0 4.75 4.42 0 10.52 0Zm4.8 8.74c-.75 0-1.34.57-1.34 1.28 0 .71.59 1.29 1.34 1.29.75 0 1.34-.58 1.34-1.29 0-.71-.59-1.28-1.34-1.28Zm-4.84 0c-.74-.01-1.35.57-1.35 1.27 0 .71.6 1.29 1.35 1.3.74 0 1.34-.58 1.34-1.29 0-.71-.6-1.28-1.34-1.28Zm-4.84 0c-.75 0-1.35.57-1.35 1.28 0 .71.61 1.29 1.35 1.29.74-.01 1.34-.58 1.34-1.29 0-.71-.6-1.28-1.34-1.28Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SidebarShareIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 23 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11.45 13.17c3.58 0 6.65.68 6.65 3.4 0 2.72-3.05 3.43-6.65 3.43-3.59 0-6.65-.68-6.65-3.4 0-2.72 3.04-3.43 6.65-3.43Zm5.73-1.63c1.37-.03 2.85.2 3.39.35 1.16.27 1.92.83 2.23 1.63.27.66.27 1.43 0 2.09-.48 1.25-2.03 1.65-2.63 1.75-.13.02-.23-.11-.22-.26.31-3.46-2.14-5.1-2.77-5.47-.03-.02-.03-.05-.03-.06 0-.01.01-.03.03-.03ZM5.56 11.53l.26.01c.02 0 .03.02.03.03.01.02 0 .04-.03.06-.63.37-3.08 2.02-2.77 5.47.01.15-.09.28-.22.26-.6-.1-2.15-.5-2.63-1.75a2.82 2.82 0 0 1 0-2.09c.31-.8 1.07-1.36 2.23-1.63.54-.16 2.02-.38 3.39-.35l-.26-.01ZM11.45 0c2.44 0 4.4 2.35 4.4 5.29s-1.96 5.29-4.4 5.29c-2.45 0-4.4-2.35-4.4-5.29S9 0 11.45 0Zm5.97.88c2.36 0 4.21 2.67 3.58 5.65-.42 2-1.97 3.33-3.68 3.27-.18 0-.35-.02-.51-.06-.12-.02-.18-.18-.11-.3.65-1.16 1.03-2.56 1.03-4.05 0-1.57-.41-3.02-1.12-4.22-.02-.03-.04-.09-.02-.13.02-.04.06-.06.09-.07.24-.06.49-.09.74-.09ZM5.58.88c.25 0 .5.04.74.09.03 0 .07.03.09.07.02.04.01.1-.02.13a8.33 8.33 0 0 0-1.12 4.22c0 1.49.38 2.89 1.03 4.05.07.12.01.28-.11.3-.16.04-.33.06-.5.06-1.72.06-3.27-1.27-3.69-3.27C1.36 3.55 3.22.88 5.58.88Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SidebarSettingsIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 19 19"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10.22 0c.75 0 1.44.4 1.82.99.18.28.3.63.27 1.01-.02.28.07.57.24.83.52.81 1.67 1.11 2.57.66 1.01-.55 2.29-.22 2.87.72l.69 1.12c.59.94.26 2.15-.76 2.69-.87.48-1.17 1.56-.65 2.37.16.26.35.48.63.61.36.18.64.47.83.75.38.59.35 1.31-.02 1.95l-.72 1.14a2.14 2.14 0 0 1-1.8.99c-.36 0-.76-.1-1.09-.29-.26-.16-.57-.22-.9-.22-1.01 0-1.86.79-1.89 1.73 0 1.09-.94 1.95-2.11 1.95h-1.4c-1.18 0-2.12-.86-2.12-1.95-.02-.94-.87-1.73-1.88-1.73-.34 0-.64.06-.9.22-.33.19-.74.29-1.08.29-.74 0-1.44-.38-1.82-.99L.29 13.7a1.86 1.86 0 0 1-.02-1.95c.17-.28.47-.57.82-.75.29-.13.47-.35.64-.61.51-.81.2-1.89-.66-2.37C.06 7.48-.27 6.27.31 5.33L1 4.21c.59-.94 1.86-1.27 2.88-.72.89.45 2.04.15 2.57-.66.16-.26.25-.55.23-.83-.02-.37.09-.72.29-1.01A2.17 2.17 0 0 1 8.78 0h1.44ZM9.51 6.82c-1.6 0-2.9 1.2-2.9 2.69 0 1.49 1.3 2.68 2.9 2.68 1.61 0 2.87-1.19 2.87-2.68 0-1.49-1.26-2.69-2.87-2.69Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="m12 3.55 2.47 5.02 5.54.8-4.01 3.91.95 5.52L12 16.2l-4.95 2.6.95-5.52-4.01-3.91 5.54-.8L12 3.55Z" />
    </svg>
  );
}
