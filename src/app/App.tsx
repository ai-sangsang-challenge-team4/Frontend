import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import { AuthSessionBoundary } from '../features/auth/components';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthSessionBoundary>
          <AppRouter />
        </AuthSessionBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
