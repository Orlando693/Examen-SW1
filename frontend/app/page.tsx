import { ProjectLandingClient } from '../components/projects/ProjectLandingClient';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

export default function Home() {
  return <ProtectedRoute returnTo="/"><ProjectLandingClient /></ProtectedRoute>;
}
