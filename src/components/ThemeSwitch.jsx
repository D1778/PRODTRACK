import Icon from "./Icon";
import { useTheme } from "../lib/theme";

// Sliding light/dark switch (sun on the left, moon on the right).
export default function ThemeSwitch({ className = "" }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`theme-switch ${dark ? "on" : ""} ${className}`}
      onClick={toggle}
    >
      <span className="theme-switch-icon sun"><Icon name="sun" /></span>
      <span className="theme-switch-icon moon"><Icon name="moon" /></span>
      <span className="theme-switch-knob">
        <Icon name={dark ? "moon" : "sun"} />
      </span>
    </button>
  );
}

// Light / Dark / System picker for the Profile page.
export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
    { value: "system", label: "System", icon: "settings" },
  ];
  return (
    <div className="range-toggle theme-picker" role="radiogroup" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          className={preference === o.value ? "active" : ""}
          onClick={() => setPreference(o.value)}
        >
          <Icon name={o.icon} /> {o.label}
        </button>
      ))}
    </div>
  );
}
