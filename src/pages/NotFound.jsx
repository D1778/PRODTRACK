import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div className="splash">
      <div className="card" style={{ maxWidth: 440, width: "calc(100% - 32px)" }}>
        <EmptyState
          icon="search"
          title="Page not found"
          text="The page you're looking for doesn't exist or has moved."
          action={
            <Link to="/" className="btn btn-primary">
              <Icon name="arrowLeft" /> Back home
            </Link>
          }
        />
      </div>
    </div>
  );
}
