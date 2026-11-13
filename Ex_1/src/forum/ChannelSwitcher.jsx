// src/forum/ChannelSwitcher.jsx
import { NavLink } from 'react-router';
import { CHANNELS } from './channels.js';
import styles from './ChannelSwitcher.module.css';

export default function ChannelSwitcher({ channels = CHANNELS }) {
  return (
    <nav aria-label="Forum channels">
      <ul className={styles.list}>
        {channels.map((channel) => (
          <li key={channel.id}>
            <NavLink
              to={`/forum/${channel.id}`}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {channel.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
