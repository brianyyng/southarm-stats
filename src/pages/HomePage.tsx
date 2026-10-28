import { Link } from "react-router-dom";
import { NextGameBanner, ScheduleList, ScoreCarousel, StatHighlights } from "../components/home";
import { Layout } from "../components/Layout";
import { ErrorNote, SectionTitle, Skeleton } from "../components/ui";
import { isUpcoming } from "../lib/game";
import { useGames, usePlayerStats, useProfiles } from "../lib/hooks";

export default function HomePage() {
  const games = useGames();
  const stats = usePlayerStats();
  const { byId } = useProfiles();
  const upcoming = (games.data ?? []).filter((g) => isUpcoming(g));
  const next = upcoming[0];

  return (
    <Layout top={<ScoreCarousel games={games.data} profiles={byId} />}>
      <div className="space-y-8">
        {games.error && <ErrorNote message={games.error} />}
        {games.loading ? (
          <Skeleton className="h-[290px]" />
        ) : next ? (
          <NextGameBanner game={next} allGames={games.data!} onChange={games.reload} />
        ) : (
          <div className="card p-5 text-muted">No upcoming games yet. Check back soon.</div>
        )}

        <section>
          <SectionTitle
            kicker="Upcoming"
            title="Schedule"
            action={
              <Link to="/schedule" className="label hover:text-chalk">
                All games →
              </Link>
            }
          />
          {games.data ? <ScheduleList games={upcoming.slice(0, 4)} allGames={games.data} /> : <Skeleton className="h-60" />}
        </section>

        <section>
          <SectionTitle
            kicker="Season leaders"
            title="Standouts"
            action={
              <Link to="/stats" className="label hover:text-chalk">
                Full table →
              </Link>
            }
          />
          <StatHighlights stats={stats.data} />
        </section>
      </div>
    </Layout>
  );
}
