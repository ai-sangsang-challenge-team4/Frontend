import type { ReactNode } from 'react';
import { Download, Info, Trash2 } from 'lucide-react';
import defaultProfileImage from '../../shared/assets/profile.png';
import { Accordion, Badge, Button, ButtonLink, Tabs } from '../../shared/components/ui';
import { ROLE_LABEL } from './authState';
import { useAuth } from './useAuth';
import './MyPagePanel.css';
import { PolicyConsentPanel } from './PolicyConsentPanel';

function PanelHeading({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mypage-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function PreparationNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mypage-notice">
      <Info aria-hidden="true" size={20} />
      <p>{children}</p>
    </div>
  );
}

export function MyPagePanel() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mypage-panel">
      <p className="mypage-intro">내 정보와 동의 내역, 데이터 관리 항목을 한곳에서 확인하세요.</p>

      <section aria-label="내 계정 요약" className="mypage-profile">
        <img alt="" aria-hidden="true" className="mypage-profile-avatar" src={defaultProfileImage} />
        <div className="mypage-profile-copy">
          <div className="mypage-profile-name">
            <h2>{user.name}</h2>
            <Badge size="sm" variant="brand">{ROLE_LABEL[user.role]}</Badge>
          </div>
          <p>{user.email}</p>
        </div>
      </section>

      <Tabs
        ariaLabel="마이페이지 메뉴"
        className="mypage-tabs"
        items={[
          {
            value: 'profile',
            label: '내 정보',
            content: (
              <div className="mypage-tab-content">
                <section aria-label="기본 정보" className="mypage-card">
                  <PanelHeading title="기본 정보" description="현재 로그인한 계정의 정보입니다." />
                  <dl className="mypage-info-list">
                    <div><dt>이름</dt><dd>{user.name}</dd></div>
                    <div><dt>이메일</dt><dd>{user.email}</dd></div>
                    <div><dt>계정 유형</dt><dd>{ROLE_LABEL[user.role]}</dd></div>
                  </dl>
                </section>

                {user.role === 'PARENT' ? (
                  <section aria-label="연결된 자녀" className="mypage-card">
                    <PanelHeading title="연결된 자녀" description="계정에 연결된 자녀 정보를 확인합니다." />
                    {user.students === undefined ? (
                      <p className="mypage-muted">연결된 자녀 정보를 아직 확인할 수 없어요.</p>
                    ) : user.students.length === 0 ? (
                      <p className="mypage-muted">연결된 자녀가 없습니다.</p>
                    ) : (
                      <ul className="mypage-student-list">
                        {user.students.map((student) => (
                          <li key={student.studentId}>
                            <img alt="" aria-hidden="true" className="mypage-student-avatar" src={defaultProfileImage} />
                            <strong>{student.name}</strong>
                            <span>학번 {student.studentNo}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}
              </div>
            ),
          },
          {
            value: 'consents',
            label: '약관 및 동의',
            content: <PolicyConsentPanel key={user.userId} />,
          },
          {
            value: 'data',
            label: '내 데이터 관리',
            content: (
              <div className="mypage-tab-content">
                <PanelHeading title="내 데이터 관리" description="내 데이터의 다운로드와 삭제를 요청하는 공간입니다." />
                <PreparationNotice>데이터 관리 기능을 준비하고 있어요. 아직 다운로드나 삭제 요청은 접수되지 않습니다.</PreparationNotice>
                <div className="mypage-data-grid">
                  <section aria-label="데이터 다운로드" className="mypage-card mypage-data-card">
                    <div className="mypage-data-title"><h3>데이터 다운로드</h3><Badge size="sm">준비 중</Badge></div>
                    <p id="mypage-download-description">내 계정에 보관된 데이터를 내려받는 기능입니다. 제공 범위와 다운로드 방법은 기능이 준비되면 안내합니다.</p>
                    <Button aria-describedby="mypage-download-description" disabled fullWidth leftIcon={<Download size={18} />} variant="outline">다운로드 요청</Button>
                  </section>
                  <section aria-label="데이터 삭제" className="mypage-card mypage-data-card">
                    <div className="mypage-data-title"><h3>데이터 삭제</h3><Badge size="sm">준비 중</Badge></div>
                    <p id="mypage-delete-description">보관 중인 내 데이터의 삭제를 요청하는 기능입니다. 삭제 대상과 처리 절차를 확인한 뒤 요청할 수 있도록 준비 중입니다.</p>
                    <Button aria-describedby="mypage-delete-description" disabled fullWidth leftIcon={<Trash2 size={18} />} variant="outline">삭제 요청</Button>
                  </section>
                </div>
                <p className="mypage-footnote">데이터 관리 요청에는 로그인과 본인 확인이 필요하며, 실제 보관된 데이터만 대상이 됩니다.</p>
              </div>
            ),
          },
          {
            value: 'help',
            label: '도움말',
            content: (
              <div className="mypage-tab-content">
                <section aria-label="자주 묻는 질문" className="mypage-card">
                  <PanelHeading title="자주 묻는 질문" description="계정과 데이터 관리에 대해 궁금한 내용을 확인하세요." />
                  <Accordion
                    className="mypage-faq"
                    items={[
                      { id: 'mypage-faq-consents', title: '동의 내역은 어디에서 확인하나요?', content: '약관 및 동의 탭에서 현재 정책의 동의 여부, 정책 버전과 동의 시각을 확인할 수 있습니다. 필수 동의를 확인하고 선택 동의를 변경한 뒤 저장할 수 있습니다.' },
                      { id: 'mypage-faq-original', title: '선택 동의는 무엇인가요?', content: '서비스 개선을 위한 메시지 활용 동의는 필수 동의와 별도로 관리하는 선택 항목입니다. 현재 계정의 동의 여부는 약관 및 동의 탭에서 확인하고 변경할 수 있습니다.' },
                      { id: 'mypage-faq-data', title: '데이터 다운로드와 삭제는 어떻게 요청하나요?', content: '내 데이터 관리 탭에서 요청할 수 있도록 준비 중입니다. 지금은 요청을 접수하지 않으며, 기능이 준비되면 본인 확인과 처리 절차를 안내합니다.' },
                    ]}
                  />
                </section>
                {user.role === 'TEACHER' ? (
                  <div className="mypage-help-link">
                    <div><h3>메시지 대응이 고민될 때</h3><p>대응 가이드에서 상담과 메시지 작성 기준을 확인하세요.</p></div>
                    <ButtonLink size="sm" to="/teacher/guide" variant="outline">대응 가이드 보기</ButtonLink>
                  </div>
                ) : null}
              </div>
            ),
          },
        ]}
      />


    </div>
  );
}
