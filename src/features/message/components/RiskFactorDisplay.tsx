import type { RiskFactor, RiskFactorIconKind } from '../types';

function getRiskFactorIconKind(factor: RiskFactor): RiskFactorIconKind {
  const text = `${factor.id} ${factor.name} ${factor.description}`;

  if (/법적|공식|교육청|신고|고소|민원/.test(text)) {
    return 'official';
  }

  if (/반복|다시|즉시|응답|압박|기한/.test(text)) {
    return 'repeat';
  }

  if (/요구|조치|설명|상담/.test(text)) {
    return 'burden';
  }

  if (/안전|정서|갈등|가정|생활/.test(text)) {
    return 'safety';
  }

  return 'default';
}

export function RiskFactorIcon({ factor }: { factor: RiskFactor }) {
  const kind = getRiskFactorIconKind(factor);

  if (kind === 'repeat') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M9.11111 20.5L6 17.3L9.11111 14.1L10.2 15.26L8.99444 16.5H16.8889V13.3H18.4444V18.1H8.99444L10.2 19.34L9.11111 20.5ZM7.55556 11.7V6.9H17.0056L15.8 5.66L16.8889 4.5L20 7.7L16.8889 10.9L15.8 9.74L17.0056 8.5H9.11111V11.7H7.55556Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === 'burden') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M16.6727 13.25L15.5909 12.2L17.1943 10.625L15.5909 9.06875L16.6727 8L18.2955 9.575L19.8989 8L21 9.06875L19.3773 10.625L21 12.2L19.8989 13.25L18.2955 11.6938L16.6727 13.25ZM7.99886 11.6188C7.39356 11.0312 7.09091 10.325 7.09091 9.5C7.09091 8.675 7.39356 7.96875 7.99886 7.38125C8.60417 6.79375 9.33182 6.5 10.1818 6.5C11.0318 6.5 11.7595 6.79375 12.3648 7.38125C12.9701 7.96875 13.2727 8.675 13.2727 9.5C13.2727 10.325 12.9701 11.0312 12.3648 11.6188C11.7595 12.2063 11.0318 12.5 10.1818 12.5C9.33182 12.5 8.60417 12.2063 7.99886 11.6188ZM4 18.5V16.4C4 15.975 4.11269 15.5844 4.33807 15.2281C4.56345 14.8719 4.86288 14.6 5.23636 14.4125C6.03485 14.025 6.84621 13.7344 7.67045 13.5406C8.4947 13.3469 9.33182 13.25 10.1818 13.25C11.0318 13.25 11.8689 13.3469 12.6932 13.5406C13.5174 13.7344 14.3288 14.025 15.1273 14.4125C15.5008 14.6 15.8002 14.8719 16.0256 15.2281C16.2509 15.5844 16.3636 15.975 16.3636 16.4V18.5H4Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === 'official') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M5 21.5V19.7105H15.6667V21.5H5ZM10.0222 17.1605L5 12.1053L6.86667 10.1816L11.9333 15.2368L10.0222 17.1605ZM15.6667 11.4789L10.6444 6.37895L12.5556 4.5L17.5778 9.55526L15.6667 11.4789ZM19.7556 20.6053L8.15556 8.92895L9.4 7.67632L21 19.3526L19.7556 20.6053Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="board-risk-factor-icon"
      fill="none"
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="25" height="25" rx="8" fill="#F8F8F8" />
      <path
        d="M12.5 4.5L4.75 18.5H20.25L12.5 4.5ZM11.75 9.75H13.25V14H11.75V9.75ZM11.75 15.25H13.25V16.75H11.75V15.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

type RiskFactorTitleProps = {
  factor: RiskFactor;
};

export function RiskFactorTitle({ factor }: RiskFactorTitleProps) {
  return (
    <span
      className={`board-risk-factor-title board-risk-factor-title--${factor.status}`}
    >
      <RiskFactorIcon factor={factor} />
      <span className="board-risk-factor-copy">
        <strong>{factor.name}</strong>
        <span>{factor.description}</span>
      </span>
    </span>
  );
}

type RiskFactorDetailProps = {
  factor: RiskFactor;
};

export function RiskFactorDetail({ factor }: RiskFactorDetailProps) {
  return (
    <div className="board-risk-factor-detail">
      <p>{factor.rationale}</p>
    </div>
  );
}
