import type { ReactNode } from 'react';

type HeaderProps = {
  actions?: ReactNode;
  title: string;
};

export function Header({ actions, title }: HeaderProps) {
  return (
    <header className="teacher-app-header">
      <h1>{title}</h1>
      {actions ? (
        <div className="teacher-app-header-actions">{actions}</div>
      ) : null}
    </header>
  );
}
