import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Presupuestos from './pages/Presupuestos';
import PresupuestoForm from './pages/PresupuestoForm';
import Clientes from './pages/Clientes';
import Responsables from './pages/Responsables';
import Tarifas from './pages/Tarifas';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/presupuestos" element={<Presupuestos />} />
                      <Route path="/presupuestos/nuevo/:tipo" element={<PresupuestoForm />} />
                      <Route path="/presupuestos/:id" element={<PresupuestoForm />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/responsables" element={<Responsables />} />
                      <Route path="/tablas" element={<Tarifas />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
