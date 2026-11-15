import { Navigate, useLocation } from 'react-router-dom';

interface RedirectToProps {
  to: string;
}

/**
 * Replaces a retired path with its new home, keeping the query string so
 * filters in old links still apply.
 */
function RedirectTo({ to }: RedirectToProps) {
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: to, search }} />;
}

export default RedirectTo;
