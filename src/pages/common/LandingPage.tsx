import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import cautionExpressionIcon from '../../shared/assets/landing/caution-expression.png';
import policyGuideIcon from '../../shared/assets/landing/policy-guide.png';
import privacyProtectionIcon from '../../shared/assets/landing/privacy-protection.png';
import responseGuideIcon from '../../shared/assets/landing/response-guide.png';
import workflowAnalysisImage from '../../shared/assets/landing/workflow-analysis.png';
import workflowMessageImage from '../../shared/assets/landing/workflow-message.png';
import workflowReplyImage from '../../shared/assets/landing/workflow-reply.png';
import { getDefaultRolePath, useAuth } from '../../features/auth';
import { LandingRoleGrid } from './LandingRoleGrid';

type FeatureItem = {
  title: string;
  description: [string, string];
  image: string;
};

type WorkflowStep = {
  badge: string;
  title: string;
  description: [string, string?];
  image: string;
};

const featureItems: FeatureItem[] = [
  {
    title: '주의 표현 확인',
    description: ['메시지 속 주의가 필요한 표현과', '그 이유를 한눈에 확인해요.'],
    image: cautionExpressionIcon,
  },
  {
    title: '대응 가이드',
    description: ['상황에 맞는 대응 방향과', '답변 작성 가이드를 확인해요.'],
    image: responseGuideIcon,
  },
  {
    title: '관련 규정 안내',
    description: ['상황과 관련된 규정과', '대응 근거를 함께 확인해요.'],
    image: policyGuideIcon,
  },
  {
    title: '개인정보 보호',
    description: ['개인 연락처를 노출하지 않고', '안전하게 소통할 수 있어요.'],
    image: privacyProtectionIcon,
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    badge: 'STEP 1',
    title: '메시지 확인',
    description: ['학부모가 보낸 메시지와 요청 내용을 확인해보세요.'],
    image: workflowMessageImage,
  },
  {
    badge: 'STEP 2',
    title: 'AI 분석',
    description: ['핵심 내용과 주의 표현을 분석하고,', '대응에 필요한 정보를 확인해보세요.'],
    image: workflowAnalysisImage,
  },
  {
    badge: 'STEP 3',
    title: '답변 작성',
    description: ['Teacher Hub가 제안한 답변을 확인하고,', '상황에 맞게 수정해보세요.'],
    image: workflowReplyImage,
  },
];

const INTRO_VISIBLE_MS = 2000;
const INTRO_TRANSITION_MS = 700;
const INTRO_SEEN_KEY = 'teacher-hub.landing-intro-seen';
let hasSeenIntro = false;

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isIntroVisible, setIsIntroVisible] = useState(() => {
    if (hasSeenIntro) return false;

    try {
      return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [isIntroExiting, setIsIntroExiting] = useState(false);
  const mainContentRef = useLandingScrollReveal(!isIntroVisible || isIntroExiting);

  useEffect(() => {
    if (user) {
      navigate(getDefaultRolePath(user.role), { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!isIntroVisible) return undefined;

    hasSeenIntro = true;
    try {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, 'true');
    } catch {
      // The module flag prevents repeat intros when session storage is blocked.
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const exitTimer = window.setTimeout(() => {
      setIsIntroExiting(true);
    }, INTRO_VISIBLE_MS);
    const doneTimer = window.setTimeout(() => {
      setIsIntroVisible(false);
      document.body.style.overflow = previousOverflow;
    }, INTRO_VISIBLE_MS + INTRO_TRANSITION_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isIntroVisible]);

  const introClassName = isIntroVisible
    ? isIntroExiting
      ? ' landing-page--intro-exiting'
      : ' landing-page--intro-active'
    : '';

  return (
    <div className={`landing-page${introClassName}`}>
      {isIntroVisible && <LandingIntroSplash isExiting={isIntroExiting} />}

      <div ref={mainContentRef} className="landing-main-content" aria-hidden={isIntroVisible}>
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-container landing-hero__inner">
            <div className="landing-hero__copy">
              <h1 id="landing-hero-title">
                교사를 보호하고,{' '}
                <br className="landing-mobile-break" />
                더 건강한 학교 소통을 만듭니다
              </h1>
              <p>
                AI가 위험 표현을 미리 살피고,{' '}
                <br className="landing-mobile-break" />
                상황에 맞는 대응을 도와 더 안전한 소통을 만듭니다.
              </p>
            </div>

            <LandingRoleGrid />

            <a className="landing-scroll-cue" href="#landing-intro">
              <span>SCROLL</span>
              <ChevronDown size={18} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section
          className="landing-intro"
          id="landing-intro"
          aria-labelledby="landing-intro-title"
        >
          <div className="landing-container landing-intro__grid" data-reveal="">
            <h2 id="landing-intro-title">
              Teacher Hub는
              <br />
              더 안전하고 편안한
              <br />
              학교 소통을 돕습니다.
            </h2>
            <p>
              교사와 학부모가 서로의 의도를
              <br />
              더 정확하게 이해하고,
              <br />
              상황에 맞게 소통할 수 있도록
              <br />
              Teacher Hub가 함께합니다.
            </p>
          </div>
        </section>

        <section className="landing-features" aria-labelledby="landing-features-title">
          <div className="landing-container">
            <div
              className="landing-section-heading landing-section-heading--center"
              data-reveal=""
            >
              <p>주요 기능</p>
              <h2 id="landing-features-title">
                학교 소통에 필요한 기능을{' '}
                <br className="landing-mobile-break" />
                한곳에서 확인하세요.
              </h2>
            </div>
            <div className="landing-feature-grid">
              {featureItems.map((item) => (
                <article className="landing-feature" key={item.title}>
                  <img src={item.image} alt="" aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>
                    {item.description[0]}
                    <br />
                    {item.description[1]}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="landing-workflow-title">
          <div className="landing-container">
            <div className="landing-section-heading" data-reveal="">
              <p>선생님의 대응이 필요한 순간</p>
              <h2 id="landing-workflow-title">
                메시지를 확인하는 순간부터{' '}
                <br className="landing-mobile-break" />
                답변까지 함께합니다.
              </h2>
              <span>
                학부모 메시지의 핵심과 주의 표현을 분석하고,{' '}
                <br className="landing-mobile-break" />
                상황에 맞는 대응 가이드와 답변 작성을 지원합니다.
              </span>
            </div>

            <div className="landing-step-list">
              {workflowSteps.map((step) => (
                <article className="landing-step-card" key={step.badge}>
                  <div className="landing-step-card__copy">
                    <strong>{step.badge}</strong>
                    <h3>{step.title}</h3>
                    <p>
                      {step.description[0]}
                      {step.description[1] && (
                        <>
                          <br />
                          {step.description[1]}
                        </>
                      )}
                    </p>
                  </div>
                  <img
                    className="landing-step-card__image"
                    src={step.image}
                    alt={`${step.title} 화면`}
                    width={980}
                    height={540}
                    loading="lazy"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-container landing-footer__legal">
            <p className="landing-footer__links">
              <span>이용약관</span>
              <span aria-hidden="true">|</span>
              <span>개인정보처리방침</span>
            </p>
            <p className="landing-footer__copyright">
              Copyright &copy; Teacher Hub.All Right Reserved
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function useLandingScrollReveal(isReady: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!content || motionPreference.matches || !('IntersectionObserver' in window)) {
      return;
    }

    const elements = content.querySelectorAll<HTMLElement>('[data-reveal]');
    elements.forEach((element) => {
      element.dataset.revealState = 'pending';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal(entry.target as HTMLElement);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });

    function reveal(element: HTMLElement) {
      element.dataset.revealState = 'visible';
      observer.unobserve(element);
    }

    function handleMotionChange() {
      if (motionPreference.matches) {
        elements.forEach(reveal);
        observer.disconnect();
      }
    }

    function handleFocus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;

      const element = event.target.closest<HTMLElement>('[data-reveal-state="pending"]');
      if (element) {
        reveal(element);
      }
    }

    // Keep reveals paused while the full-screen intro is covering the page.
    if (isReady) {
      elements.forEach((element) => observer.observe(element));
    }

    motionPreference.addEventListener('change', handleMotionChange);
    content.addEventListener('focusin', handleFocus);

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener('change', handleMotionChange);
      content.removeEventListener('focusin', handleFocus);
      elements.forEach((element) => {
        delete element.dataset.revealState;
      });
    };
  }, [isReady]);

  return contentRef;
}

function LandingIntroSplash({ isExiting }: { isExiting: boolean }) {
  return (
    <div
      className={`landing-intro-splash${isExiting ? ' landing-intro-splash--exiting' : ''}`}
      role="status"
    >
      <p className="landing-intro-splash__title">
        안전한 소통,
        <br />
        명확한 대응
      </p>
    </div>
  );
}
