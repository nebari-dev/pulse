import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from '@/components/Header';
import { ThemeProvider } from '@/hooks/theme-provider';
import NotFound from '@/pages/NotFound';
import Overview from '@/pages/Overview';
import Product from '@/pages/Product';

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-canvas text-canvas-foreground">
            <Header />
            <main className="w-full flex-1 px-6 py-8">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/product/:id" element={<Product />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
