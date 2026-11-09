// Vite-only fixture: exercise shared components without adding a product/demo route.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Accordion, Badge, Button, ButtonLink, Dropdown, InformationTooltip, Modal, Popover, Select, StatusChip, Tabs, TextareaField, TextField, Tooltip } from '../../src/shared/components/ui';
import { BoardConfirmDialog } from '../../src/features/message/components/BoardConfirmDialog';
import { RiskBadge } from '../../src/features/message/components/RiskBadge';
import '../../src/index.css';
import '../../src/features/message/TeacherMessages.css';
import '../../src/features/parent-message/ParentMessageComposer.css';

function PortalDialogCase() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)}>포털 창 열기</Button>
    <Modal open={open} onOpenChange={setOpen} title="포털 확인">
      <TextField autoFocus label="포털 입력" />
      <Button onClick={() => setOpen(false)}>포털 창 닫기</Button>
    </Modal>
  </>;
}

function ReviewCases() {
  const [controlledOpen, setControlledOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lowerOpen, setLowerOpen] = useState(false);
  const [upperOpen, setUpperOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  return <>
    <Popover ariaLabel="제어 설명" open={controlledOpen} onOpenChange={setControlledOpen} trigger="제어 설명 열기">
      <TextField label="제어 설명 입력" />
    </Popover>
    <Button onClick={() => setControlledOpen(false)}>설명 밖 작업</Button>
    <Popover ariaLabel="포털 설명" trigger="포털 설명 열기"><PortalDialogCase /></Popover>
    <Tooltip content="입력 형식 설명">
      <TextField id="tooltip-validating-field" label="설명 입력 필드" helperText="도움말" error={hasError ? '오류 안내' : undefined} />
    </Tooltip>
    <Button onClick={() => setHasError((current) => !current)}>입력 오류 전환</Button>
    <Button onClick={() => setLowerOpen(true)}>아래 창 열기</Button>
    <Modal open={lowerOpen} onOpenChange={setLowerOpen} title="아래 창">
      <Button onClick={() => setUpperOpen(true)}>위 창 열기</Button>
      <TextField label="아래 창 입력" />
    </Modal>
    <Modal open={upperOpen} onOpenChange={setUpperOpen} title="위 창">
      <Button onClick={() => setLowerOpen(false)}>아래 창만 닫기</Button>
      <Button onClick={() => setUpperOpen(false)}>위 창만 닫기</Button>
    </Modal>
    <Button onClick={() => setSelectOpen(true)}>선택 창 열기</Button>
    <Modal open={selectOpen} onOpenChange={setSelectOpen} title="선택 확인">
      <Dropdown ariaLabel="대화상자 값 선택" defaultValue="a" options={[
        { label: '선택 첫 항목', value: 'a' }, { label: '선택 마지막 항목', value: 'b' },
      ]} />
    </Modal>
  </>;
}

export function Fixture() {
  const [dialog, setDialog] = useState<'common' | 'board' | null>(null);
  const [count, setCount] = useState(0);
  return <main style={{ padding: 16, display: 'grid', gap: 24 }}>
    <h1>공통 UI 검증</h1>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Button>기본 버튼</Button><Button variant="secondary">보조 버튼</Button><Button variant="outline">외곽 버튼</Button>
      <Button variant="ghost">도구 버튼</Button><Button variant="danger">삭제 버튼</Button>
      <Button disabled>비활성 버튼</Button><Button isLoading>전송 중</Button><ButtonLink to="#link">이동 링크</ButtonLink>
    </div>
    <div><Dropdown ariaLabel="값 선택" defaultValue="a" options={[
      { label: '첫 항목', value: 'a' }, { label: '사용 불가', value: 'b', disabled: true },
      { label: '마지막 항목', value: 'c', description: '보조 설명' },
    ]} /><Button variant="outline">다음 작업</Button></div>
    <TextField label="텍스트" helperText="도움말" error="텍스트 오류" aria-describedby="external-hint" />
    <p id="external-hint">외부 설명</p>
    <TextareaField label="긴 입력" helperText="도움말" error="긴 입력 오류" />
    <Select label="선택 입력" helperText="도움말" error="선택 오류" options={[{ label: '선택값', value: 'a' }]} />
    <TextField label="학부모 입력" containerClassName="parent-write-field" error="필수 입력입니다." />
    <Tabs ariaLabel="내용 전환" items={[
      { value: 'a', label: '첫 탭', content: '첫 내용' }, { value: 'b', label: '잠긴 탭', disabled: true },
      { value: 'c', label: '마지막 탭', content: '마지막 내용' },
    ]} />
    <Accordion items={[{ id: 'same', title: '첫 설명', content: '첫 설명 본문' }]} />
    <Accordion items={[{ id: 'other', title: '다른 설명', content: '다른 설명 본문' }]} />
    <Popover ariaLabel="추가 정보" trigger="추가 정보 열기"><p>짧은 설명</p><a href="#more">관련 문서</a><InformationTooltip label="보조 정보 설명" content="Popover 안의 용어 설명입니다." /></Popover>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><InformationTooltip label="용어 설명" content="AI 완충 요약은 위험 표현의 노출을 줄인 요약입니다." /></div>
    <Tooltip content="비활성 작업의 보조 설명"><Button disabled>제한된 작업</Button></Tooltip>
    <Tooltip content="텍스트 설명"><span>도움이 필요한 용어</span></Tooltip>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <RiskBadge level="normal" /><RiskBadge level="attention" /><RiskBadge level="danger" /><RiskBadge level="urgent" />
      <Badge variant="danger">오류 안내</Badge><Badge variant="critical">긴급</Badge>
      <StatusChip status="progress" label="아주 긴 한국어 상담 진행 상태입니다" />
    </div>
    <ReviewCases />
    <Button onClick={() => setDialog('common')}>일반 확인창</Button>
    <Button onClick={() => setDialog('board')}>업무 확인창</Button>
    <Modal open={dialog === 'common'} title="공통 확인" onOpenChange={() => setDialog(null)} footer={<Button onClick={() => setDialog(null)}>확인</Button>}>
      <Button disabled>사용 불가 작업</Button><Button style={{ display: 'none' }}>숨긴 작업</Button>
      <TextField label="확인 메모" /><InformationTooltip label="확인 설명" content="선택적인 확인 설명입니다." />
    </Modal>
    <BoardConfirmDialog open={dialog === 'board'} title="업무 확인" titleId="board-title" onClose={() => setDialog(null)}
      actions={[{ label: '취소', onClick: () => setDialog(null) }, { label: '진행', onClick: () => setDialog(null), disabled: true }]}>
      <Button onClick={() => setCount(count + 1)}>재렌더링 {count}</Button>
    </BoardConfirmDialog>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><Fixture /></BrowserRouter></StrictMode>);
