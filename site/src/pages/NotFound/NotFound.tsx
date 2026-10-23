import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-semibold text-4xl tracking-tight">404</h1>
      <p className="mt-4 text-muted-foreground">
        Nothing is tracked at this address.
      </p>
      <Link
        to="/"
        className="mt-8 inline-block text-primary underline-offset-4 hover:underline"
      >
        Back to downloads
      </Link>
    </div>
  );
}

export default NotFound;
