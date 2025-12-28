import { IconMoon } from "../../icons/icon-moon";
import { IconSun } from "../../icons/icon-sun";

import "./header.styles.css";

interface HeaderProps {
    isDarkTheme: boolean;
    toggleTheme: () => void;
}

export const Header = ({ isDarkTheme, toggleTheme }: HeaderProps) => {
  return (
    <header className="header">
      <h2>Multik</h2>
      <button id="themeToggle" className="theme-toggle" aria-label="Toggle Dark Mode" onClick={toggleTheme}>
        {isDarkTheme ? (
            <IconMoon />
        ) : (
            <IconSun />
        )}
      </button>
    </header>
  )
}