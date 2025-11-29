import { memo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const Header = memo(() => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="header">
      <h2>Multik</h2>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        title={isDark ? 'Светлая тема' : 'Темная тема'}
      >
        {isDark ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
