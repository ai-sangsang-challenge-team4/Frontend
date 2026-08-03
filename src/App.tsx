import './App.css';

const highlights = [
  'React 19',
  'TypeScript',
  'Vite',
  'ESLint',
];

function App() {
  return (
    <main className="app">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">AI 상상챌린지</p>
        <h1 id="page-title">상상을 제품으로 빠르게 빚어내는 프론트엔드</h1>
        <p className="description">
          아이디어 검증부터 데모 구현까지 이어갈 수 있도록 React 기반 개발 환경을
          준비했습니다.
        </p>
        <div className="stack" aria-label="프로젝트 기술 스택">
          {highlights.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
