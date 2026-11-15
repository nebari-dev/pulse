import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RedirectTo from './RedirectTo';

function Where() {
  const { pathname, search } = useLocation();
  return <p>{`${pathname}${search}`}</p>;
}

describe('RedirectTo', () => {
  it('moves to the new path and keeps the query string', () => {
    render(
      <MemoryRouter initialEntries={['/releases?kind=pack']}>
        <Routes>
          <Route path="/releases" element={<RedirectTo to="/repos" />} />
          <Route path="/repos" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('/repos?kind=pack')).toBeInTheDocument();
  });
});
