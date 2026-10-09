import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";
import { useDocumentTitle } from "../hooks";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return <EmptyState icon="search" title="Page not found" description="The page you're looking for doesn't exist or has moved." action={<Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>} />;
}
