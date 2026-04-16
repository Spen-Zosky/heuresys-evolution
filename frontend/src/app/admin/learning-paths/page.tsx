import { redirect } from 'next/navigation';

/**
 * Redirect /admin/learning-paths -> /admin/learning/paths
 * The actual page lives at /admin/learning/paths.
 * This redirect prevents 404s when the hyphenated URL is used.
 */
export default function LearningPathsRedirect() {
  redirect('/admin/learning/paths');
}
