import { ScheduleList } from "../components/home";
import { Layout } from "../components/Layout";
import { ErrorNote, SectionTitle, Skeleton } from "../components/ui";
import { isUpcoming } from "../lib/game";
import { useGames } from "../lib/hooks";

export default function SchedulePage() {
  const games = useGames();
  const all = games.data ?? [];
  const upcoming = all.filter((g) => isUpcoming(g));
  const past = all.filter((g) => !isUpcoming(g)).reverse();

  return (
    <Layout>
      <div className="space-y-8">
        {games.error && <ErrorNote message={games.error} />}
        <section>
          <SectionTitle kicker="Sign-ups open 7 days before kickoff" title="Upcoming" />
          {games.data ? <ScheduleList games={upcoming} allGames={all} /> : <Skeleton className="h-60" />}
        </section>
        {past.length > 0 && (
          <section>
            <SectionTitle kicker="Full time" title="Results" />
            <ScheduleList games={past} allGames={all} />
          </section>
        )}
      </div>
    </Layout>
  );
}
