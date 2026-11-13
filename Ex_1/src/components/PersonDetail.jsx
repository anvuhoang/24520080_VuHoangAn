// src/components/PersonDetail.jsx
import { useParams } from 'react-router';
import { PEOPLE } from '../data/people.js';
import NotFoundState from './NotFoundState.jsx';
import styles from './PersonDetail.module.css';

export default function PersonDetail({ people = PEOPLE }) {
  const { id } = useParams();
  const person = people.find((candidate) => candidate.id === id);

  if (!person) {
    return (
      <NotFoundState
        title="Person not found"
        message={`There is no dossier for "${id}".`}
        backLabel="Back to the list"
      />
    );
  }

  return (
    <article className={styles.card} aria-labelledby={`dossier-${person.id}`}>
      <h2 id={`dossier-${person.id}`} className={styles.name}>
        {person.name}
      </h2>
      <dl className={styles.details}>
        <dt>Role</dt>
        <dd>{person.role}</dd>
        <dt>Team</dt>
        <dd>{person.team}</dd>
        <dt>Active since</dt>
        <dd>{person.since}</dd>
      </dl>
    </article>
  );
}
