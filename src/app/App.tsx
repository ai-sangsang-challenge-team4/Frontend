import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
