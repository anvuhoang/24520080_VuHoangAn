import DeveloperCard from './components/DeveloperCard.jsx';
import styles from './App.module.css';

const PLAYERS = [
  {
    id: 'player-kylian-mbappe',
    fullName: 'Kylian Mbappé',
    role: 'Forward · Real Madrid',
    avatarUrl: '/avatars/mbappe.jpg',
    metrics: { Goals: 44, Assists: 5, Matches: 56 },
    skills: [
      { id: 'mbappe-pace', name: 'Pace', tier: 'Core' },
      { id: 'mbappe-finishing', name: 'Finishing', tier: 'Awareness' },
      { id: 'mbappe-defending', name: 'Defending', tier: 'Later' },
    ],
  },
  {
    id: 'player-lionel-messi',
    fullName: 'Lionel Messi',
    role: 'Forward · Inter Miami',
    // Deliberately missing file: the 404 triggers onError and the initials fallback
    avatarUrl: '/avatars/messi-missing.jpg',
    metrics: { Goals: 29, Assists: 19, Matches: 39 },
    skills: [
      { id: 'messi-dribbling', name: 'Dribbling', tier: 'Core' },
      { id: 'messi-free-kicks', name: 'Free Kicks', tier: 'Awareness' },
      { id: 'messi-heading', name: 'Heading', tier: 'Later' },
    ],
  },
  {
    id: 'player-erling-haaland',
    fullName: 'Erling Haaland',
    role: 'Striker · Manchester City',
    avatarUrl: '/avatars/haaland.jpg',
    metrics: { Goals: 34, Assists: 4, Matches: 45 },
    skills: [
      { id: 'haaland-finishing', name: 'Finishing', tier: 'Core' },
      { id: 'haaland-aerial', name: 'Aerial Duels', tier: 'Awareness' },
      { id: 'haaland-dribbling', name: 'Dribbling', tier: 'Later' },
    ],
  },
  {
    id: 'player-virgil-van-dijk',
    fullName: 'Virgil van Dijk',
    role: 'Defender · Liverpool',
    avatarUrl: '/avatars/vandijk.jpg',
    metrics: { Goals: 4, Assists: 2, Matches: 50 },
    skills: [
      { id: 'vandijk-tackling', name: 'Tackling', tier: 'Core' },
      { id: 'vandijk-passing', name: 'Long Passing', tier: 'Awareness' },
      { id: 'vandijk-dribbling', name: 'Dribbling', tier: 'Later' },
    ],
  },
];

export default function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Football Player Cards</h1>
      <section className={styles.grid} aria-label="Player cards">
        {PLAYERS.map(({ id, ...player }) => (
          <DeveloperCard key={id} {...player} />
        ))}
      </section>
    </main>
  );
}